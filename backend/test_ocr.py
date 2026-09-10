import sys, importlib
sys.path.insert(0, '.')
import ocr
importlib.reload(ocr)

for i in range(1, 11):
    pad = f'0{i}' if i < 10 else '10'
    fname = f'demo_docs/test_{pad}_doc.png'
    try:
        r = ocr.extract_document_info(fname)
        nlp = r.get('ocr_debug', {}).get('nlp_fields', [])
        fields_found = len([f for f in nlp if f['value'] != 'Not detected'])
        name = r['extracted_name'][:20]
        dob = r['extracted_dob'][:15]
        doc = r['extracted_doc_number'][:12]
        exp = r['extracted_expiry'][:15]
        status = r['status']
        print(f'Test {pad}: {status:12s} name={name:20s} dob={dob:15s} doc={doc:12s} exp={exp:15s} nlp={fields_found}')
    except Exception as e:
        print(f'Test {pad}: ERROR - {e}')
