import unittest,subprocess,json,sys,base64,math,pathlib
ROOT=pathlib.Path(__file__).resolve().parent
REPO=ROOT.parent.parent

def worker(data):
 p=subprocess.run([sys.executable,str(ROOT/'worker.py')],input=json.dumps(data),text=True,capture_output=True,timeout=60)
 return json.loads(p.stdout)
def part(id='plate',shape='box',dimensions=None):return {'id':id,'shape':shape,'dimensions':dimensions or {'length':80,'width':50,'height':6},'position':[0,0,0],'rotation':[0,0,0]}
class CADTests(unittest.TestCase):
 def test_box_real_solid_and_step_roundtrip(self):
  d=worker({'action':'build','components':[part()]});self.assertTrue(d['parts'][0]['valid']);self.assertAlmostEqual(d['parts'][0]['volume'],24000,places=4);self.assertIn(b'ISO-10303-21',base64.b64decode(d['step'])[:100]);self.assertGreater(len(base64.b64decode(d['stl'])),100)
  r=worker({'action':'import','file':d['step']});self.assertEqual(len(r['parts']),1);self.assertAlmostEqual(r['parts'][0]['volume'],24000,places=3)
 def test_tube_bore_is_real_geometry(self):
  d=worker({'action':'build','components':[part('tube','tube',{'length':50,'diameter':20,'innerDiameter':12})]});self.assertAlmostEqual(d['parts'][0]['volume'],math.pi*(100-36)*50,places=3)
 def test_pocket_removes_actual_material(self):
  p=part(dimensions={'length':56,'width':26,'height':4});p['pocket']={'wall':2,'floor':2}
  d=worker({'action':'build','components':[p]});self.assertTrue(d['parts'][0]['valid']);self.assertAlmostEqual(d['parts'][0]['volume'],3536,places=4)
 def test_impossible_pocket_rejected(self):
  p=part();p['pocket']={'wall':30,'floor':2}
  d=worker({'action':'build','components':[p]});self.assertIn('error',d)
 def test_missing_dimensions_rejected(self):
  d=worker({'action':'build','components':[part(dimensions={'length':80,'width':None,'height':6})]});self.assertIn('error',d)
 def test_pdf_real_text_page_and_render(self):
  raw=base64.b64encode((REPO/'apps/web/tests/fixtures/mechanical-dimensions.pdf').read_bytes()).decode();d=worker({'action':'document','file':raw});self.assertEqual(d['pages'][0]['page'],1);self.assertIn('80 x 50 x 6 mm',d['pages'][0]['text']);self.assertEqual(base64.b64decode(d['pages'][0]['image'])[:4],b'\x89PNG')
if __name__=='__main__':unittest.main()
