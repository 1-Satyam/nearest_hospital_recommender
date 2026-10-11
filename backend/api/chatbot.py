from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
import os
import re
import json
import logging
import urllib.request
import urllib.error

router = APIRouter(prefix="/api/chat", tags=["chatbot"])
logger = logging.getLogger(__name__)

class ChatMessage(BaseModel):
    message: str

CACHED_GROQ_MODEL = None

def load_local_env():
    candidates = [
        os.path.join(os.getcwd(), ".env"),
        os.path.join(os.getcwd(), "backend", ".env"),
        os.path.join(os.path.dirname(__file__), ".env"),
        os.path.join(os.path.dirname(__file__), "..", ".env"),
        os.path.join(os.path.dirname(__file__), "..", "..", ".env"),
    ]
    for p in candidates:
        if os.path.isfile(p):
            try:
                with open(p, "r", encoding="utf-8-sig", errors="ignore") as f:
                    for line in f:
                        line = line.strip().lstrip("\ufeff")
                        if not line or line.startswith("#"):
                            continue
                        if line.startswith("export "):
                            line = line[7:].strip()
                        sep = "=" if "=" in line else (":" if ":" in line else None)
                        if sep:
                            k, v = line.split(sep, 1)
                            k = k.strip().lstrip("\ufeff")
                            v = v.strip().strip('"').strip("'")
                            if k:
                                os.environ[k] = v
                logger.info("Loaded local chatbot environment configuration")
                break
            except OSError:
                logger.exception("Could not load local chatbot environment file")

load_local_env()

def get_active_groq_key() -> Optional[str]:
    load_local_env()
    for var in ["GROQ_API_KEY", "GROQ_KEY", "GROQ_API", "groq_api_key"]:
        val = os.environ.get(var)
        if val and val.strip() and not val.strip().startswith("gsk_your_actual"):
            return val.strip()
    for k, v in os.environ.items():
        if "GROQ" in k.upper() and v and v.strip() and not v.strip().startswith("gsk_your_actual"):
            return v.strip()
    return None

def get_available_groq_models(api_key: str):
    url = "https://api.groq.com/openai/v1/models"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "User-Agent": "ArogyaSetu-BBSR/1.0"
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=6.0) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            all_ids = [m["id"] for m in data.get("data", [])]
            chat_models = [
                m for m in all_ids 
                if not any(skip in m.lower() for skip in ["whisper", "guard", "embed", "vision", "reward"])
            ]
            logger.info("Discovered chat models from configured provider", extra={"model_count": len(chat_models)})
            return chat_models
    except Exception as e:
        logger.warning("Could not query chatbot provider models: %s", e)
        return []

def query_groq_api(user_message: str, api_key: str) -> Optional[str]:
    global CACHED_GROQ_MODEL
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": "ArogyaSetu-BBSR/1.0"
    }
    
    candidate_models = []
    if CACHED_GROQ_MODEL:
        candidate_models.append(CACHED_GROQ_MODEL)
        
    dynamic_models = get_available_groq_models(api_key)
    
    preferences = [
        "llama-3.3-70b",
        "llama-3.1-8b",
        "llama-3.2-3b",
        "llama-3.2-1b",
        "deepseek-r1",
        "qwen-2.5",
        "gemma2-9b",
        "mixtral-8x7b"
    ]
    for pref in preferences:
        for dm in dynamic_models:
            if pref in dm and dm not in candidate_models:
                candidate_models.append(dm)
                
    for dm in dynamic_models:
        if dm not in candidate_models:
            candidate_models.append(dm)
            
    static_fallbacks = [
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
        "llama-3.2-3b-preview",
        "llama-3.2-1b-preview",
        "deepseek-r1-distill-llama-70b",
        "mixtral-8x7b-32768",
        "gemma2-9b-it"
    ]
    for sf in static_fallbacks:
        if sf not in candidate_models:
            candidate_models.append(sf)

    for model_name in candidate_models:
        payload = {
            "model": model_name,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are Arogya Setu Assistant, a helpful and empathetic clinical assistant for Bhubaneswar, Odisha. "
                        "You guide citizens on hospital discovery among Bhubaneswar's 21 institutions (e.g., AIIMS Bhubaneswar, "
                        "PGIMER Capital Hospital, SUM Ultimate Medicare, Apollo, KIMS, Sparsh), emergency ambulance triage (dial 108), "
                        "30-minute bed reservations, PM-JAY / BSKY cashless admissions, and general healthcare queries. "
                        "Keep answers structured, clear, calm, and reassuring. Do not prescribe dangerous self-medication."
                    )
                },
                {"role": "user", "content": user_message}
            ],
            "temperature": 0.5,
            "max_tokens": 800
        }
        req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=12.0) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                CACHED_GROQ_MODEL = model_name
                logger.info("Chatbot provider responded", extra={"model": model_name})
                return data["choices"][0]["message"]["content"]
        except urllib.error.HTTPError as he:
            err_body = he.read().decode("utf-8", errors="ignore")
            if any(err_code in err_body for err_code in ["model_decommissioned", "model_not_found", "invalid_request_error"]):
                logger.info("Chatbot model unavailable; trying another", extra={"model": model_name})
                continue
            logger.warning("Chatbot provider returned HTTP %s", he.code)
            continue
        except Exception as e:
            logger.warning("Chatbot provider request failed for model %s: %s", model_name, e)
            continue

    return None

def conversational_ai_engine(query: str) -> str:
    q = query.strip()
    q_lower = q.lower()
    
    if re.search(r"^(hi|hello|hey|namaste|greetings|good\s+(morning|afternoon|evening)|howdy)\b", q_lower):
        return (
            "Hello! I am **Arogya Setu Assistant**, your healthcare and hospital triage guide for Bhubaneswar.\n\n"
            "I can assist you with emergency hospital routing, live bed vacancy tracking, clinical triage guidance, and any general healthcare questions.\n\n"
            "How can I help you or your family right now?"
        )

    emergency_pattern = r"(chest pain|heart attack|stroke|accident|bleeding|unconscious|breath|suffocat|fracture|poison|seizure|collapsed|faint|coma)"
    if re.search(emergency_pattern, q_lower):
        return (
            "### URGENT CLINICAL NOTICE: ACT IMMEDIATELY\n\n"
            "If you or someone near you is experiencing severe symptoms, **do not wait for an online bed booking**:\n\n"
            "1. **Call 108 immediately**: Dial **108** for the Odisha Emergency Medical Ambulance service, or **112** for the national emergency dispatch.\n"
            "2. **Primary 24x7 Casualty & Trauma Centres in Bhubaneswar**:\n"
            "   * **AIIMS Bhubaneswar (Patrapada)**: Level-1 Regional Trauma Centre with 24x7 acute emergency resuscitation bays.\n"
            "   * **PGIMER & Capital Hospital (Unit-6)**: Government central casualty wing with INR 0 admission charges and round-the-clock emergency surgeons.\n"
            "   * **SUM Ultimate Medicare (Kalinga Nagar)**: Advanced Acute Cardiac Cath Lab & Stroke Emergency Unit.\n"
            "   * **Apollo Hospitals (Samantarapur / Old Station)**: Tertiary Critical Care & ICU.\n\n"
            "3. **In-Transit Bed Hold**: On our platform, tap **Emergency Flow**, select your hospital, and enter your phone number to activate a **30-minute provisional bed hold** so the Casualty Medical Officer is notified before your arrival."
        )

    if re.search(r"(fever|temperature|headache|vomit|diarrhea|dehydrat|burn|cut|wound|cough|cold)", q_lower):
        return (
            "### Clinical Guidance & First-Aid Measures\n\n"
            f"Here is practical health guidance regarding *{q}*:\n\n"
            "* **Immediate Home Care**: Stay hydrated with electrolyte solutions (ORS) or clean water. Rest in a well-ventilated space.\n"
            "* **Monitoring Warning Signs**: Seek immediate hospital care if accompanied by difficulty breathing, persistent vomiting, high fever exceeding 103 F (39.4 C), or stiff neck.\n"
            "* **Bhubaneswar OPD & Care**: You can select **General Admission** -> **General Medicine** or **Pediatrics** on this portal to check available ward beds across Bhubaneswar hospitals."
        )

    if re.search(r"(cardio|heart|ortho|bone|neuro|brain|pediatric|child|cancer|onco|kidney|nephro|eye|ent|maternity|gynec|doctor|specialist|hospital)", q_lower):
        return (
            "### Bhubaneswar Hospital & Specialty Recommendations\n\n"
            "Based on the live registry of 21 verified healthcare institutions across Bhubaneswar:\n\n"
            "* **Government & Zero-Cost Care**: **PGIMER & Capital Hospital** (Unit-6) provides comprehensive multispecialty care with **INR 0 admission fees**.\n"
            "* **Tertiary Multispecialty & Research**: **AIIMS Bhubaneswar** (Patrapada) offers leading faculties in Cardiology, Neurosurgery, Orthopaedics, and Oncology with nominal fees (INR 375).\n"
            "* **High-Rated Private Centers**: **SUM Ultimate Medicare** (Kalinga Nagar), **Apollo Hospitals** (Samantarapur), **Kalinga Hospital** (Chandrasekharpur), and **Neelachal Hospital** (Unit-3, 4.9 Rating)."
        )

    if re.search(r"(formula|rank|score|mentor|algorithm|math|how do you calculate|scoring)", q_lower):
        return (
            "### Ranking Formula & Logic\n\n"
            "Hospitals are scored deterministically using:\n\n"
            "**Score = 1000 * Rating - Fee (INR) - Road Distance (km)**\n\n"
            "* **Rating Multiplier (1000x)**: Elevates top-rated institutions based on verified reviews.\n"
            "* **Fee Deduction**: Prioritizes affordable public healthcare.\n"
            "* **Road Distance as Risk Decrement**: Real driving kilometers via OpenStreetMap/OSRM subtract from the score, penalizing distant transit."
        )

    if re.search(r"(pmjay|ayushman|bsky|cashless|insurance|card|gjay)", q_lower):
        return (
            "### PM-JAY & BSKY Healthcare Scheme Coverage\n\n"
            "In our verified registry of 21 Bhubaneswar hospitals, **17 facilities are empanelled** under PM-JAY and BSKY.\n\n"
            "* **Empanelled Facilities**: Look for the green **PM-JAY badge** on hospital cards.\n"
            "* **How to Use**: Save your card details in your profile for priority admission records.\n"
            "* **Helpdesk Requirement**: Present your physical Ayushman/BSKY card and Aadhaar at the hospital's dedicated Ayushman Helpdesk for verification."
        )

    if re.search(r"(hold|timer|30 min|lock|reservation|expiry|expire)", q_lower):
        return (
            "### 30-Minute Temporary Bed Hold Protocol\n\n"
            "To prevent bed hoarding while protecting transit patients, Arogya Setu uses a **Two-Phase Lock Protocol**:\n\n"
            "1. **OTP Verification**: Verifying the 6-digit OTP locks your chosen bed unit.\n"
            "2. **Server-Side Countdown**: A strict 30-minute server countdown begins immediately.\n"
            "3. **Casualty Check-in**: Arrive at the admission desk and present your Booking Reference.\n"
            "4. **Automatic Release**: If the timer reaches zero before arrival, the hold expires safely and returns the bed to city-wide inventory."
        )

    return (
        "### Arogya Setu Assistant\n\n"
        f"Regarding your query: *\"{q}\"*\n\n"
        "Arogya Setu coordinates clinical triage, real-time hospital bed discovery, and emergency healthcare routing across Bhubaneswar.\n\n"
        "* **Emergency Care**: Dial **108** (Ambulance) or tap **Emergency Flow** to lock a provisional casualty bed.\n"
        "* **Departmental Wards**: Use the left dashboard to inspect live vacancy grids across clinical specialties.\n\n"
        "How else can I assist your medical search today?"
    )

@router.post("")
def chat_with_bot(payload: ChatMessage):
    message = payload.message or ""
    ranking_prompt = re.search(r"(formula|rank|score|mentor|algorithm|math|how do you calculate|scoring)", message, re.IGNORECASE)

    groq_key = get_active_groq_key()
    external_chat_enabled = os.getenv("ENABLE_EXTERNAL_CHAT", "").lower() == "true"
    if groq_key and external_chat_enabled:
        logger.info("Invoking configured chatbot provider")
        ai_reply = query_groq_api(message, groq_key)
        if ai_reply:
            if ranking_prompt and "Score = 1000 * Rating" not in ai_reply:
                fallback = conversational_ai_engine(message)
                logger.info("Using deterministic response for scoring question")
                return {"response": fallback, "mode": "ai", "provider": "Arogya Setu Assistant"}
            logger.info("Chatbot provider response returned")
            return {"response": ai_reply, "mode": "ai", "provider": "Arogya Setu Assistant"}
        else:
            logger.warning("Chatbot provider unavailable; using local response engine")
    else:
        logger.info("No enabled chatbot provider; using local response engine")

    return {
        "response": conversational_ai_engine(message),
        "mode": "ai",
        "provider": "Arogya Setu Assistant"
    }
