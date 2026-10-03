import importlib.util
import json
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

TRAINING=Path(__file__).resolve().parents[2]/'ai_training'
sys.path.insert(0,str(TRAINING))
from data_workbench import extract,export_catalog


class WorkbenchTest(unittest.TestCase):
    def test_export_does_not_export_private_tables_or_product_extras(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td);src=root/'db.json'
            src.write_text(json.dumps({'users':[{'passwordHash':'secret'}],'orders':[{'address':'private'}],
                'products':[{'id':'p','name':'Áo','status':'published','privateNote':'hidden'},
                            {'id':'h','name':'Hidden','status':'hidden'}]}))
            export_catalog(src,root/'out');text=(root/'out/catalog.json').read_text()
            self.assertNotIn('secret',text);self.assertNotIn('private',text);self.assertNotIn('hidden',text)
            self.assertEqual(len(json.loads(text)),1)

    def test_zip_traversal_rejected_before_writing(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td);archive=root/'bad.zip'
            with zipfile.ZipFile(archive,'w') as z:
                z.writestr('normal.csv','ok');z.writestr('../outside.csv','bad')
            with self.assertRaises(ValueError):extract(archive,root/'out')
            self.assertFalse((root/'out/normal.csv').exists());self.assertFalse((root/'outside.csv').exists())

    def test_downloaded_code_is_not_extracted(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td);archive=root/'source.zip'
            with zipfile.ZipFile(archive,'w') as z:z.writestr('run.py','raise RuntimeError()');z.writestr('rows.csv','a,b')
            extract(archive,root/'out');self.assertFalse((root/'out/run.py').exists());self.assertTrue((root/'out/rows.csv').exists())


if __name__=='__main__':unittest.main()
