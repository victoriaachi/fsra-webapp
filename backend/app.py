from gevent import monkey
monkey.patch_all()

from flask import Flask, jsonify, request
from flask_cors import CORS
from compare import compare_bp
from ror import ror_bp

app = Flask(__name__)
CORS(app)

@app.route("/home", methods=["GET"])
def return_home():
    return jsonify({
        'message': "test"
    })

@app.route("/")
def home():
    return jsonify({"message": "Welcome to the pension legislation app!"})

@app.route("/hello")
def hello():
    return jsonify({"message": "Hello from Flask!"})

app.register_blueprint(compare_bp)
app.register_blueprint(ror_bp)

if __name__ == "__main__":
    app.run(debug=True, port=8080)





