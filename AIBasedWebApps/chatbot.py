from flask import Flask, render_template, request, jsonify, send_file
import requests
import os
from gtts import gTTS
import torch
from PIL import Image
from transformers import BlipProcessor, BlipForConditionalGeneration

import tensorflow as tf
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.applications.mobilenet_v2 import decode_predictions, preprocess_input
import numpy as np

from transformers.utils import logging

logging.set_verbosity_info()  # Set logging to show download progress


app = Flask(__name__, template_folder="templates", static_folder="static")

API_KEY = "YOUR-API-KEY"

AUDIO_FOLDER = "static/audio"
os.makedirs(AUDIO_FOLDER, exist_ok=True)

UPLOAD_FOLDER = "static/uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

print("Downloading BLIP processor and model...")
processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-large")
model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-large").to("cpu")
print("Model downloaded successfully!")

model_classify = MobileNetV2(weights="imagenet")

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/chatbot")
def chatbot_page():
    return render_template("chatbot.html")

@app.route("/search")
def search_page():
    return render_template("ai_search.html")

@app.route("/recommend")
def recommend_page():
    return render_template("recommendation.html")

@app.route("/captioning")
def captioning_page():
    return render_template("image_captioning.html")

@app.route("/classification")
def classification_page():
    return render_template("image_classification.html")

@app.route("/speech_chatbot")
def speech_chatbot_page():
    return render_template("speech_chatbot.html")

@app.route("/flower_identification")
def flower_identification_page():
    return render_template("flower_identification.html")

chat_history = []
@app.route("/chatbot", methods=["POST"])
def chatbot():
    data = request.json
    user_message = data.get("message", "")

    if not user_message:
        return jsonify({"error": "User message is required"}), 400

    # Add user input to chat history
    chat_history.append({"role": "user", "content": user_message})

    response = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
        json={
            "model": "google/gemini-2.0-flash-lite-preview-02-05:free",
            "messages": chat_history,  # Send entire chat history
            "temperature": 1.0
        }
    )

    # ✅ Check if API response is valid
    if response.status_code != 200:
        return jsonify({"error": "API request failed", "details": response.json()}), 500

    response_data = response.json()
    if "choices" not in response_data:
        return jsonify({"error": "Invalid API response", "details": response_data}), 500

    ai_reply = response_data["choices"][0]["message"]["content"]

    # Add AI response to chat history
    chat_history.append({"role": "assistant", "content": ai_reply})

    # Convert AI response to speech (TTS)
    audio_path = os.path.join(AUDIO_FOLDER, "response.mp3")
    speech = gTTS(text=ai_reply, lang="en")
    speech.save(audio_path)


    return jsonify({"reply": ai_reply, "history": chat_history, "audio":'/static/audio/response.mp3'})  # Send back full chat history

@app.route('/static/audio/response.mp3',methods=['GET'])
def get_audio():
    return send_file("static/audio/response.mp3",mimetype='audio/mpeg')



@app.route("/search", methods=["POST"])
def search_ai():
    data = request.json
    query = data.get("query", "")
    if not query:
        return jsonify({"error": "User query is required"}), 400
    chat_history.append({"role": "user", "content": query})

    response = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
        json={
            "model": "google/gemini-2.0-flash-lite-preview-02-05:free",
            "messages": [
                {"role": "system",
                 "content": "You are an AI-powered search assistant. Provide relevant information in short points."},
                {"role": "user", "content": f"Find information about {query}."}
            ],
            "temperature": 0.7,
            "top_p": 0.9
        }
    )

    if response.status_code != 200:
        return jsonify({"error": "API request failed", "details": response.json()}), 500

    response_data = response.json()

    if "choices" not in response_data:
        return jsonify({"error": "Invalid API response", "details": response_data}), 500

    search_results = response_data["choices"][0]["message"]["content"]  # Convert AI output to a list of dictionaries

    return jsonify({"search_results": search_results})

@app.route("/recommend", methods=["POST"])
def get_recommendations():
    data = request.json
    user_preference = data.get("preference", "").strip()

    if not user_preference:
        return jsonify({"error": "Preference input is required"}), 400

    response = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
        json={
            "model": "google/gemini-2.0-flash-lite-preview-02-05:free",
            "messages": [
                {"role": "system", "content": "You are an AI-powered recommendation assistant. Provide a structured list of recommendations without bullet points, formatted like this:\n\nTitle: [Book Name]\nAuthor: [Author Name]\nDescription: [Short summary]\n\nAvoid markdown or special formatting."},
                {"role": "user", "content": f"Recommend some top {user_preference}."}
            ],
            "temperature": 0.8
        }
    )

    if response.status_code != 200:
        return jsonify({"error": "API request failed", "details": response.json()}), 500

    response_data = response.json()

    if "choices" not in response_data:
        return jsonify({"error": "Invalid API response", "details": response_data}), 500

    ai_reply = response_data["choices"][0]["message"]["content"]

    return jsonify({"recommendations": str(ai_reply)})


@app.route("/caption", methods=["POST"])
def generate_caption():
    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    image_file = request.files["image"]
    image_path = os.path.join(UPLOAD_FOLDER, image_file.filename)
    image_file.save(image_path)

    # Process image and generate caption
    image = Image.open(image_path).convert("RGB")
    inputs = processor(images=image, return_tensors="pt").to("cpu")

    with torch.no_grad():
        output = model.generate(**inputs)
        caption = processor.decode(output[0], skip_special_tokens=True)

    return jsonify({"caption": caption, "image_url": f"/{image_path}"})


@app.route("/classify", methods=["POST"])
def classify():
    if "image" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400

    # Save the uploaded image
    filepath = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(filepath)

    # Load and preprocess the image
    image = Image.open(filepath).convert("RGB").resize((224, 224))
    image_array = np.array(image)
    image_array = preprocess_input(np.expand_dims(image_array, axis=0))

    # Perform inference
    predictions = model_classify.predict(image_array)
    decoded_predictions = decode_predictions(predictions, top=3)[0]

    # Format the results
    results = [{"label": label, "score": float(score)} for _, label, score in decoded_predictions]

    return jsonify({"image_url": filepath, "predictions": results})

if __name__ == "__main__":
    app.run(debug=True)
