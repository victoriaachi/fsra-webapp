from flask import Blueprint, jsonify, request

pba_bp = Blueprint('pba', __name__)

@pba_bp.route('/pba', methods=['POST'])
def submit_keyword():
    data = request.json
    keyword = data.get('keyword', '')
    print(f"Received keyword in blueprint: {keyword}")
    # You can process keyword here
    
    return jsonify({"message": f"Keyword '{keyword}' received successfully!"})
