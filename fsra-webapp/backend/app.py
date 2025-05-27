from flask import Flask, jsonify, request
from test import compare_numbers
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route("/home", methods=["GET"])
def return_home():
    return jsonify({
        'message': "test"
    })

@app.route("/compare", methods=["POST"])
def compare():
    data = request.get_json()
    num1 = data.get("num1")
    num2 = data.get("num2")

    if num1 is None or num2 is None:
        return jsonify({"error": "Missing numbers"}), 400

    result = compare_numbers(num1, num2)
    return jsonify({"result": result})

@app.route("/")
def home():
    return jsonify({"message": "Welcome to the pension legislation app!"})

@app.route("/hello")
def hello():
    return jsonify({"message": "Hello from Flask!"})

if __name__ == "__main__":
    app.run(debug=True, port=8080)





