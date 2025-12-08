from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
from dotenv import load_dotenv
import re

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
MODEL_NAME = "llama-3.1-8b-instant"
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"


@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({
        "status": "healthy",
        "provider": "Groq",
        "model": MODEL_NAME,
        "message": "AI motivational generator is ready!"
    })

@app.route("/get_motivation", methods=["POST"])
def get_motivation():
    data = request.json or {}
    print(" Received data:", data)

    
    try:
        points = int(data.get("points", 0))
        hours = int(data.get("hours", 0))
        streak = int(data.get("streak", 0))  
        initiatives = int(data.get("initiatives", 0))
        challenges = int(data.get("challenges", 0))
    except (ValueError, TypeError):
        points = hours = streak = initiatives = challenges = 0

    
    if points < 100 and streak < 2:
        tone = "warm and encouraging"
    elif points < 500:
        tone = "congratulatory and motivating"
    else:
        tone = "celebratory and inspiring"

    
    system_prompt = (
        f"You are an enthusiastic motivational coach for volunteers. "
        f"Generate a {tone} message in exactly 1-2 short sentences. "
        f"Keep each sentence under 12 words. Use simple, punchy language. "
        f"Add 1-2 relevant emojis. Be specific about their achievements."
    )

    user_prompt = (
        f"Volunteer stats:\n"
        f"- {points} points\n"
        f"- {hours} volunteer hours\n"
        f"- {initiatives} initiatives joined\n"
        f"- {challenges} challenges completed\n"
        f"- {streak} week streak\n\n"  
        f"Write a motivational message (1-2 sentences, max 12 words each)."
    )

    payload = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "max_tokens": 80,
        "temperature": 0.85,
        "top_p": 0.9
    }

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    try:
        print(" Calling Groq API...")
        response = requests.post(GROQ_API_URL, headers=headers, json=payload, timeout=20)
        response.raise_for_status()
        result = response.json()
        
        print(" Groq API Response:", result)

        
        choices = result.get("choices", [])
        if choices:
            message_obj = choices[0].get("message", {})
            raw_message = message_obj.get("content", "").strip()
            
            print(f" Raw message: {raw_message}")

            if raw_message:
                
                message = raw_message.replace('**', '').replace('*', '')
                
                
                sentences = re.split(r'(?<=[.!?])\s+', message)
                
                
                if len(sentences) > 2:
                    message = ' '.join(sentences[:2])
                
                
                if message and message[-1] not in '.!?':
                    message += '.'
                    
                print(f" Final message: {message}")
                return jsonify({"message": message})

        print(" No valid message generated")
        return jsonify({"message": None})

    except requests.exceptions.Timeout:
        print(" Groq API timeout")
        return jsonify({"message": None})
    except requests.exceptions.RequestException as e:
        print(f" Error calling Groq API: {e}")
        if hasattr(e, 'response') and e.response:
            print(f"Response: {e.response.text}")
        return jsonify({"message": None})
    except Exception as e:
        print(f" Unexpected error: {e}")
        return jsonify({"message": None})

if __name__ == "__main__":
    print("=" * 60)
    print("GROQ-POWERED AI MOTIVATIONAL GENERATOR")
    print("=" * 60)
    app.run(host="0.0.0.0", port=5000, debug=True)