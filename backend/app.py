import os
import cv2
import time
from flask import Flask, request, jsonify, Response, send_from_directory
from flask_cors import CORS
from ultralytics import YOLO
from werkzeug.utils import secure_filename

app = Flask(__name__)
CORS(app)

# --- KONFIGURASI ---
UPLOAD_FOLDER = 'uploads'
RESULT_FOLDER = 'results'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULT_FOLDER, exist_ok=True)

model = YOLO("best.pt") 

# --- GENERATOR STREAMING ---
def generate_frames(path_x):
    cap = cv2.VideoCapture(path_x)
    try:
        while cap.isOpened():
            success, frame = cap.read()
            if not success: break
            
            results = model(frame, verbose=False)
            annotated_frame = results[0].plot()
            ret, buffer = cv2.imencode('.jpg', annotated_frame)
            frame_bytes = buffer.tobytes()
            
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
            # Jeda dikit biar CPU napas
            time.sleep(0.01)
    except Exception as e:
        print(f"Stream ended/error: {e}")
    finally:
        # PENTING: Lepas video segera setelah stream putus
        cap.release()

def process_image(filepath, filename):
    img = cv2.imread(filepath)
    results = model(img)
    res_plotted = results[0].plot()
    
    save_path = os.path.join(RESULT_FOLDER, "res_" + filename)
    cv2.imwrite(save_path, res_plotted)
    
    detections = [model.names[int(box.cls[0])] for box in results[0].boxes]
    return "res_" + filename, ", ".join(set(detections)) if detections else "Aman"

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files: return jsonify({'error': 'No file'}), 400
    file = request.files['file']
    filename = secure_filename(file.filename)
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)
    
    file_ext = filename.lower().split('.')[-1]
    
    if file_ext in ['mp4', 'avi', 'mov', 'mkv', 'webm']:
        return jsonify({
            'result_url': f"http://localhost:5000/video_feed/{filename}",
            'filename': filename,
            'status': "Sedang Menganalisa Video...",
            'type': 'video_stream'
        })
    else:
        result_filename, status = process_image(filepath, filename)
        return jsonify({
            'result_url': f"http://localhost:5000/results/{result_filename}",
            'filename': filename,
            'result_filename': result_filename,
            'status': status,
            'type': 'image'
        })

# --- CLEANUP DENGAN RETRY (SOLUSI VIDEO TIDAK BISA DIHAPUS) ---
@app.route('/cleanup', methods=['POST'])
def cleanup_file():
    data = request.json
    filename = data.get('filename')
    result_filename = data.get('result_filename')
    
    # Fungsi pembantu untuk menghapus file bandel
    def force_delete(file_path):
        if not os.path.exists(file_path): return
        
        # Coba hapus sampai 10 kali (total 1 detik)
        for i in range(10):
            try:
                os.remove(file_path)
                print(f"Berhasil dihapus: {file_path}")
                return
            except PermissionError:
                # Kalau masih dikunci Python, tunggu 0.1 detik lalu coba lagi
                time.sleep(0.1)
            except Exception as e:
                print(f"Error lain: {e}")
                return

    if filename:
        force_delete(os.path.join(UPLOAD_FOLDER, filename))
        
    if result_filename:
        force_delete(os.path.join(RESULT_FOLDER, result_filename))
                
    return jsonify({'status': 'cleaned'})

@app.route('/video_feed/<filename>')
def video_feed(filename):
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    return Response(generate_frames(filepath), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/results/<filename>')
def result_file(filename):
    return send_from_directory(RESULT_FOLDER, filename)

if __name__ == '__main__':
    app.run(debug=True, port=5000, threaded=True)