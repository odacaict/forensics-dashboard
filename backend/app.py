from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import re

app = Flask(__name__)
CORS(app)

@app.route('/incarca_secundare', methods=['POST'])
def incarca_secundare():
    base_dir = os.path.dirname(__file__)
    temp_dir = os.path.join(base_dir, 'temporar')  # directorul temporar
    secundare_path = os.path.join(base_dir, 'secundare.txt')

    # Creează folderul temporar dacă nu există
    os.makedirs(temp_dir, exist_ok=True)

    if 'files' not in request.files:
        files = request.files.values()
    else:
        files = request.files.getlist('files')

    if not files:
        return jsonify({'status': 'error', 'message': 'Nu s-au trimis fișiere!'}), 400

    saved_filenames = []
    for file in files:
        if file and file.filename.endswith('.py'):
            filepath = os.path.join(temp_dir, file.filename)  # << aici salvezi în temporar/
            file.save(filepath)
            saved_filenames.append(file.filename)

    # scrie denumirile fișierelor în secundare.txt (rescrie de fiecare dată)
    with open(secundare_path, 'w', encoding='utf-8') as f:
        for name in saved_filenames:
            f.write(f"{name}\n")

    return jsonify({'status': 'ok', 'files': saved_filenames})

@app.route('/set_principal', methods=['POST'])
def set_principal():
    data = request.get_json()
    word = data.get('filename', '').strip()
    if '/' in word or '\\' in word or not word:
        return jsonify({'status': 'error', 'message': 'Nume invalid!'}), 400

    base_dir = os.path.dirname(__file__)
    principal_path = os.path.join(base_dir, 'principal.txt')

    # 1. Scriem cuvântul principal direct în principal.txt
    with open(principal_path, 'w', encoding='utf-8') as f:
        f.write(word)

    # 2. Căutăm fișierele unde apare cuvântul, pentru feedback (dar nu îl mai scriem aici)
    found_files = []
    for fname in os.listdir(base_dir):
        if fname.endswith('.py') and fname != os.path.basename(__file__):
            try:
                with open(os.path.join(base_dir, fname), 'r', encoding='utf-8') as f:
                    for line in f:
                        line_stripped = line.lstrip()
                        if (
                            line_stripped.lower().startswith('import') or
                            line_stripped.lower().startswith('from')
                        ):
                            if (
                                re.search(rf'(\s|\.|,|=|:|;|[\(\)\[\]{{}}]){re.escape(word)}(\s|,|$)', line)
                                or re.search(rf'\.{re.escape(word)}\b', line)
                            ):
                                found_files.append(fname)
                                break
            except Exception as e:
                continue

    return jsonify({'status': 'ok', 'matched_files': found_files})

@app.route('/analizeaza_secundare', methods=['POST'])
def analizeaza_secundare():
    base_dir = os.path.dirname(__file__)
    temp_dir = os.path.join(base_dir, 'temporar')
    parent_dir = os.path.abspath(os.path.join(base_dir, ".."))
    principal_path = os.path.join(base_dir, 'principal.txt')
    secundare_txt_path = os.path.join(parent_dir, 'secundare.txt')

    if not os.path.isfile(principal_path):
        return jsonify({'status': 'error', 'message': 'Nu există principal.txt'}), 400
    with open(principal_path, 'r', encoding='utf-8') as f:
        modul_principal = f.read().strip()
    if not modul_principal:
        return jsonify({'status': 'error', 'message': 'principal.txt e gol!'}), 400

    potrivite = []
    if os.path.isdir(temp_dir):
        for fname in os.listdir(temp_dir):
            if fname.endswith('.py'):
                try:
                    with open(os.path.join(temp_dir, fname), 'r', encoding='utf-8') as f:
                        for line in f:
                            l = line.strip()
                            if (l.startswith('import') or l.startswith('from') or l.startswith('From')):
                                if (re.search(rf'(\s|\.|,|=|:|;|[\(\)\[\]{{}}]){re.escape(modul_principal)}(\s|,|$)', line)
                                    or re.search(rf'\.{re.escape(modul_principal)}\b', line)):
                                    potrivite.append(fname)
                                    break
                except Exception:
                    continue

    # Scrie în ../secundare.txt
    with open(secundare_txt_path, 'w', encoding='utf-8') as f:
        for fname in potrivite:
            f.write(f"{fname}\n")

    # ȘTERGE toate fișierele .py din temporar/
    if os.path.isdir(temp_dir):
        for fname in os.listdir(temp_dir):
            if fname.endswith('.py'):
                try:
                    os.remove(os.path.join(temp_dir, fname))
                except Exception:
                    pass

    return jsonify({'status': 'ok', 'secundare': potrivite})


    # Scrie în ../secundare.txt
    with open(secundare_txt_path, 'w', encoding='utf-8') as f:
        for fname in potrivite:
            f.write(f"{fname}\n")
    
    return jsonify({'status': 'ok', 'secundare': potrivite})

@app.route('/get_secundare', methods=['GET'])
def get_secundare():
    base_dir = os.path.dirname(__file__)
    parent_dir = os.path.abspath(os.path.join(base_dir, ".."))
    secundare_txt_path = os.path.join(parent_dir, 'secundare.txt')
    if not os.path.isfile(secundare_txt_path):
        return "", 200
    with open(secundare_txt_path, 'r', encoding='utf-8') as f:
        continut = f.read()
    return continut, 200, {'Content-Type': 'text/plain; charset=utf-8'}

@app.route('/')
def home():
    return 'Analiza se face la fiecare POST pe /set_principal. Verifică principal.txt pentru rezultate!'

if __name__ == '__main__':
    app.run(debug=True)
