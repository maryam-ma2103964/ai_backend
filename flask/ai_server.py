from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
from dotenv import load_dotenv
load_dotenv()

# -----------------------------
# CONFIGURATION
# -----------------------------
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# -----------------------------
# GROQ API SETTINGS
# -----------------------------
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

MODEL_NAME = "llama-3.1-8b-instant"
ROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

# -----------------------------
# HEALTH CHECK
# -----------------------------
@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({
        "status": "healthy",
        "provider": "Groq",
        "model": MODEL_NAME,
        "message": "AI motivational generator is ready!"
    })

# -----------------------------
# MOTIVATION ENDPOINT
# -----------------------------
@app.route("/get_motivation", methods=["POST"])
def get_motivation():
    data = request.json or {}
    print("🔹 Received data:", data)

    # Safely parse numbers
    try:
        points = int(data.get("points", 0))
        hours = int(data.get("hours", 0))
        streak = int(data.get("streak", 0))
        initiatives = int(data.get("initiatives", 0))
    except ValueError:
        points = hours = streak = initiatives = 0

    # -----------------------------
    # SYSTEM PROMPT: AI Instructions
    # -----------------------------
    system_prompt = (
        "You are an enthusiastic, creative motivational coach for volunteers. "
        "Generate a very short motivational message, maximum 2 sentences. "
        "Each sentence should be concise, simple, and easy to read (3-8 words). "
        "Tone depends on progress: "
        "- Low points/streak: warm encouragement. "
        "- Medium points/streak: congratulate and motivate. "
        "- High points/streak: celebrate and inspire. "
        "Use natural language and emojis sparingly. Make every message punchy and easy to read."
    )


    # -----------------------------
    # USER PROMPT
    # -----------------------------
    user_prompt = (
    f"The volunteer has the following achievements:\n"
    f"- Points: {points}\n"
    f"- Volunteer Hours: {hours}\n"
    f"- Initiatives Joined: {initiatives}\n"
    f"- Current Streak: {streak} days\n\n"
    "Generate a short motivational message (max 2 concise sentences, each 3-8 words)."
)


    payload = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "max_tokens": 80,  # lower token count to force brevity
        "temperature": 0.9,
        "top_p": 0.95
    }

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    # -----------------------------
    # CALL GROQ API
    # -----------------------------
    try:
        response = requests.post(ROQ_API_URL, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        result = response.json()

        choices = result.get("choices", [])
        message = "Keep going! You're making a difference!"  # fallback

        if choices:
            message = choices[0].get("message", {}).get("content", message).strip()
            if message.startswith('"') and message.endswith('"'):
                message = message[1:-1]

            # Ensure max two sentences
            sentences = message.split('.')
            message = '.'.join(sentences[:2]).strip()
            if not message.endswith('.'):
                message += '.'

    except Exception as e:
        print(f"❌ Error calling Groq API: {e}")
        # Intelligent fallback (max 2 sentences)
        if points < 50:
            message = "Start small. Keep going! 🌱"
        elif points < 200:
            message = "Great job! Stay consistent! 💪"
        else:
            message = "Amazing work! Inspire others! ✨"


    return jsonify({"message": message})


# -----------------------------
# RUN SERVER
# -----------------------------
if __name__ == "__main__":
    print("="*60)
    print("🚀 GROQ-POWERED AI MOTIVATIONAL GENERATOR")
    print("="*60)
    app.run(host="0.0.0.0", port=5000, debug=True)

