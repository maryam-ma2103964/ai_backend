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
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

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
        challenges = int(data.get("challenges", 0))  # ✅ Added challenges
    except ValueError:
        points = hours = streak = initiatives = challenges = 0

    # -----------------------------
    # DETERMINE LEVEL BASED ON POINTS
    # -----------------------------
    if points < 2500:
        level = "Bronze"
        activity_level = "low"
    elif points < 7500:
        level = "Silver"
        activity_level = "medium"
    elif points < 15000:
        level = "Gold"
        activity_level = "high"
    else:
        level = "Platinum"
        activity_level = "very high"

    # -----------------------------
    # SYSTEM PROMPT: AI Instructions
    # -----------------------------
    system_prompt = (
        "You are an enthusiastic, creative motivational coach for volunteers. "
        "Generate a very short motivational message, maximum 2 sentences. "
        "Each sentence should be concise, simple, and easy to read (5-10 words). "
        "Tone depends on the volunteer's level: "
        f"- Bronze (0-2,499 points): warm encouragement to build momentum and start strong. "
        f"- Silver (2,500-7,499 points): congratulate progress and motivate consistency. "
        f"- Gold (7,500-14,999 points): celebrate achievements and encourage community leadership. "
        f"- Platinum (15,000+ points): honor exceptional dedication and inspire others. "
        "Use natural language and emojis sparingly. Make every message punchy, genuine, and easy to read. "
        f"The volunteer is currently at {level} level with {activity_level} activity."
    )

    # -----------------------------
    # USER PROMPT
    # -----------------------------
    user_prompt = (
        f"The volunteer is at {level} level and has the following achievements:\n"
        f"- Total Points: {points}\n"
        f"- Volunteer Hours: {hours}\n"
        f"- Initiatives Joined: {initiatives}\n"
        f"- Challenges Completed: {challenges}\n"
        f"- Current Streak: {streak} weeks\n\n"
        f"Generate a short motivational message (max 2 concise sentences, each 5-10 words) "
        f"that matches their {level} level achievement. Make it personal and encouraging."
    )

    payload = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "max_tokens": 80,
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
        response = requests.post(GROQ_API_URL, headers=headers, json=payload, timeout=30)
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
        # ✅ Intelligent fallback based on level
        if points < 2500:  # Bronze
            message = "Every journey starts with one step! 🌱"
        elif points < 7500:  # Silver
            message = "Great progress! Keep building momentum! 💪"
        elif points < 15000:  # Gold
            message = "Impressive work! You're making real impact! ⭐"
        else:  # Platinum
            message = "Exceptional dedication! You inspire the community! 👑"

    return jsonify({"message": message})


# -----------------------------
# RUN SERVER
# -----------------------------
if __name__ == "__main__":
    print("="*60)
    print("🚀 GROQ-POWERED AI MOTIVATIONAL GENERATOR")
    print("="*60)
    app.run(host="0.0.0.0", port=5000, debug=True)