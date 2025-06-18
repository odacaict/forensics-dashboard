# Forensics Dashboard

## Descriere

**Forensics Dashboard** este o aplicație web interactivă concepută pentru analiză vizuală și logică a relațiilor dintre scripturi Python. Aplicația permite încărcarea unui script principal și a mai multor scripturi secundare pentru a detecta și vizualiza conexiunile bazate pe importurile Python. Acest proiect combină un frontend interactiv și intuitiv cu un backend Flask simplu și eficient.

## Structura proiectului

```
forensics-dashboard
│   index.html
│   modulDetectie.js
│   script.js
│   secundare.txt
│   style.css
│
└───backend
    │   app.py
    │   principal.txt
    │   secundare.txt
    │
    └───temporar
```

## Caracteristici principale

- **Încărcare interactivă**: utilizatorii pot selecta și încărca scripturi Python (un script principal și până la 100 de scripturi secundare).
- **Analiza automată a importurilor**: detectează relațiile de import dintre scripturi folosind logica backendului Flask.
- **Vizualizare grafică**: prezintă relațiile detectate sub formă de conexiuni grafice interactive (linii și miniaturi dinamice).
- **Raport automat**: generează și afișează un raport clar privind importurile și relațiile dintre scripturi.
- **Interfață prietenoasă**: design modern și intuitiv cu feedback vizual clar și controale ușor accesibile.

## Tehnologii utilizate

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Python, Flask
- **Biblioteci suplimentare**: Flask-CORS (pentru gestionarea cererilor cross-origin)

## Instrucțiuni de utilizare

1. Pornește serverul Flask din folderul `backend`:

   ```bash
   python app.py
   ```

2. Deschide `index.html` în browser.

3. Utilizează interfața pentru încărcarea scriptului principal și a scripturilor secundare.

4. Apasă butonul **START** pentru analiza automată și vizualizarea rezultatelor.

## Contribuție

Proiectul este deschis pentru contribuții și îmbunătățiri. Orice feedback, sugestii sau contribuții sunt binevenite!

## Autor

Creat de [Numele Tău] - [Link către profil GitHub sau altă pagină personală]

