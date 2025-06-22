from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import re
import json
import ast
import io

app = Flask(__name__)
CORS(app)

def extract_entities_from_code(code):
    """Extrage funcțiile și clasele dintr-un cod Python"""
    entities = {'functions': [], 'classes': []}
    try:
        tree = ast.parse(code)
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                entities['functions'].append(node.name)
            elif isinstance(node, ast.ClassDef):
                entities['classes'].append(node.name)
    except:
        # Fallback la regex dacă AST parsing eșuează
        lines = code.split('\n')
        for line in lines:
            line = line.strip()
            if line.startswith('def '):
                match = re.match(r'def\s+(\w+)', line)
                if match:
                    entities['functions'].append(match.group(1))
            elif line.startswith('class '):
                match = re.match(r'class\s+(\w+)', line)
                if match:
                    entities['classes'].append(match.group(1))
    return entities

def analyze_imports_detailed(code, module_name, entities):
    """Analizează importurile detaliat pentru a identifica ce entități sunt importate"""
    imported_entities = {'functions': [], 'classes': []}
    
    try:
        tree = ast.parse(code)
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom):
                # from module import ...
                if node.module and module_name in node.module:
                    for alias in node.names:
                        name = alias.name
                        if name == '*':
                            # Import all
                            imported_entities['functions'] = entities['functions'][:]
                            imported_entities['classes'] = entities['classes'][:]
                        elif name in entities['functions']:
                            imported_entities['functions'].append(name)
                        elif name in entities['classes']:
                            imported_entities['classes'].append(name)
            elif isinstance(node, ast.Import):
                # import module
                for alias in node.names:
                    if module_name in alias.name:
                        # Verifică utilizarea în cod
                        module_alias = alias.asname if alias.asname else alias.name
                        for entity in entities['functions'] + entities['classes']:
                            pattern = rf'{re.escape(module_alias)}\.{re.escape(entity)}\b'
                            if re.search(pattern, code):
                                if entity in entities['functions']:
                                    imported_entities['functions'].append(entity)
                                else:
                                    imported_entities['classes'].append(entity)
    except:
        # Fallback la regex
        lines = code.split('\n')
        for line in lines:
            line = line.strip()
            if line.startswith(('import ', 'from ')):
                if module_name in line:
                    # Verifică ce entități sunt menționate
                    for func in entities['functions']:
                        if func in line:
                            imported_entities['functions'].append(func)
                    for cls in entities['classes']:
                        if cls in line:
                            imported_entities['classes'].append(cls)
    
    # Elimină duplicatele
    imported_entities['functions'] = list(set(imported_entities['functions']))
    imported_entities['classes'] = list(set(imported_entities['classes']))
    
    return imported_entities

@app.route('/incarca_secundare', methods=['POST'])
def incarca_secundare():
    base_dir = os.path.dirname(__file__)
    temp_dir = os.path.join(base_dir, 'temporar')
    secundare_path = os.path.join(base_dir, 'secundare.txt')

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
            filepath = os.path.join(temp_dir, file.filename)
            file.save(filepath)
            saved_filenames.append(file.filename)

    with open(secundare_path, 'w', encoding='utf-8') as f:
        for name in saved_filenames:
            f.write(f"{name}\n")

    return jsonify({'status': 'ok', 'files': saved_filenames})

@app.route('/set_principal', methods=['POST'])
def set_principal():
    data = request.get_json()
    word = data.get('filename', '').strip()
    content = data.get('content', '')  # Acum primim și conținutul
    
    if '/' in word or '\\' in word or not word:
        return jsonify({'status': 'error', 'message': 'Nume invalid!'}), 400

    base_dir = os.path.dirname(__file__)
    principal_path = os.path.join(base_dir, 'principal.txt')
    entities_path = os.path.join(base_dir, 'entities.json')

    # Salvează numele modulului
    with open(principal_path, 'w', encoding='utf-8') as f:
        f.write(word)

    # Extrage și salvează entitățile
    entities = extract_entities_from_code(content)
    with open(entities_path, 'w', encoding='utf-8') as f:
        json.dump(entities, f)

    return jsonify({
        'status': 'ok',
        'entities': entities
    })

@app.route('/get_entities', methods=['GET'])
def get_entities():
    base_dir = os.path.dirname(__file__)
    entities_path = os.path.join(base_dir, 'entities.json')
    
    if not os.path.exists(entities_path):
        return jsonify({'functions': [], 'classes': []})
    
    with open(entities_path, 'r', encoding='utf-8') as f:
        entities = json.load(f)
    
    return jsonify(entities)

@app.route('/analizeaza_secundare', methods=['POST'])
def analizeaza_secundare():
    base_dir = os.path.dirname(__file__)
    temp_dir = os.path.join(base_dir, 'temporar')
    parent_dir = os.path.abspath(os.path.join(base_dir, ".."))
    principal_path = os.path.join(base_dir, 'principal.txt')
    entities_path = os.path.join(base_dir, 'entities.json')
    secundare_txt_path = os.path.join(parent_dir, 'secundare.txt')
    analysis_path = os.path.join(base_dir, 'analysis.json')

    if not os.path.isfile(principal_path):
        return jsonify({'status': 'error', 'message': 'Nu există principal.txt'}), 400
    
    with open(principal_path, 'r', encoding='utf-8') as f:
        modul_principal = f.read().strip()
    
    if not modul_principal:
        return jsonify({'status': 'error', 'message': 'principal.txt e gol!'}), 400

    # Citește entitățile
    entities = {'functions': [], 'classes': []}
    if os.path.exists(entities_path):
        with open(entities_path, 'r', encoding='utf-8') as f:
            entities = json.load(f)

    potrivite = []
    detailed_analysis = {}
    
    if os.path.isdir(temp_dir):
        for fname in os.listdir(temp_dir):
            if fname.endswith('.py'):
                try:
                    filepath = os.path.join(temp_dir, fname)
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    # Verifică dacă importă modulul principal
                    imports_module = False
                    for line in content.split('\n'):
                        l = line.strip()
                        if (l.startswith(('import', 'from', 'From'))):
                            if modul_principal in line:
                                imports_module = True
                                break
                    
                    if imports_module:
                        potrivite.append(fname)
                        # Analizează detaliat ce importă
                        imported = analyze_imports_detailed(content, modul_principal, entities)
                        detailed_analysis[fname] = imported
                        
                except Exception as e:
                    print(f"Error analyzing {fname}: {e}")
                    continue

    # Salvează analiza detaliată
    with open(analysis_path, 'w', encoding='utf-8') as f:
        json.dump(detailed_analysis, f)

    # Scrie în ../secundare.txt
    with open(secundare_txt_path, 'w', encoding='utf-8') as f:
        for fname in potrivite:
            f.write(f"{fname}\n")

    # Șterge fișierele temporare
    if os.path.isdir(temp_dir):
        for fname in os.listdir(temp_dir):
            if fname.endswith('.py'):
                try:
                    os.remove(os.path.join(temp_dir, fname))
                except Exception:
                    pass

    return jsonify({
        'status': 'ok',
        'secundare': potrivite,
        'analysis': detailed_analysis
    })

@app.route('/get_analysis', methods=['GET'])
def get_analysis():
    base_dir = os.path.dirname(__file__)
    analysis_path = os.path.join(base_dir, 'analysis.json')
    
    if not os.path.exists(analysis_path):
        return jsonify({})
    
    with open(analysis_path, 'r', encoding='utf-8') as f:
        analysis = json.load(f)
    
    return jsonify(analysis)

@app.route('/save_edited_file', methods=['POST'])
def save_edited_file():
    data = request.get_json()
    filename = data.get('filename', '')
    content = data.get('content', '')
    
    if not filename or not content:
        return jsonify({'status': 'error', 'message': 'Date invalide'}), 400
    
    # Creează un fișier temporar și returnează-l pentru descărcare
    file_io = io.BytesIO()
    file_io.write(content.encode('utf-8'))
    file_io.seek(0)
    
    return send_file(
        file_io,
        as_attachment=True,
        download_name=filename,
        mimetype='text/x-python'
    )

@app.route('/reanalyze_file', methods=['POST'])
def reanalyze_file():
    data = request.get_json()
    filename = data.get('filename', '')
    content = data.get('content', '')
    
    if not filename or content is None:
        return jsonify({'status': 'error', 'message': 'Date invalide'}), 400
    
    base_dir = os.path.dirname(__file__)
    principal_path = os.path.join(base_dir, 'principal.txt')
    entities_path = os.path.join(base_dir, 'entities.json')
    
    # Citește modulul principal și entitățile
    with open(principal_path, 'r', encoding='utf-8') as f:
        modul_principal = f.read().strip()
    
    entities = {'functions': [], 'classes': []}
    if os.path.exists(entities_path):
        with open(entities_path, 'r', encoding='utf-8') as f:
            entities = json.load(f)
    
    # Analizează dacă importă modulul principal
    imports_module = False
    for line in content.split('\n'):
        l = line.strip()
        if (l.startswith(('import', 'from', 'From'))):
            if modul_principal in line:
                imports_module = True
                break
    
    result = {
        'imports': imports_module,
        'entities': {'functions': [], 'classes': []}
    }
    
    if imports_module:
        # Analizează detaliat ce importă
        result['entities'] = analyze_imports_detailed(content, modul_principal, entities)
    
    return jsonify(result)

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
    return 'Forensics Dashboard Backend - Analiză avansată Python'

if __name__ == '__main__':
    app.run(debug=True)