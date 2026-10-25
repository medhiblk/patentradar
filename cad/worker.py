"""Fixed operations only. Never executes model-generated code. Millimetres, degrees."""
import sys,json,base64,tempfile,os,math
try:
 import resource
 resource.setrlimit(resource.RLIMIT_CPU,(40,40))
 resource.setrlimit(resource.RLIMIT_FSIZE,(32000000,32000000))
except ImportError:pass

def run(data):
 action=data.get('action')
 if action=='document':
  import pypdfium2 as pdfium
  raw=base64.b64decode(data['file'],validate=True)
  doc=pdfium.PdfDocument(raw)
  if len(doc)>80:raise ValueError('PDF exceeds 80 pages')
  pages=[]
  for i in range(min(len(doc),20)):
   page=doc[i];textpage=page.get_textpage();text=textpage.get_text_range()[:8000];textpage.close()
   image=None
   if i<4:
    from io import BytesIO
    bitmap=page.render(scale=min(1.2,1200/max(page.get_size())));im=bitmap.to_pil();out=BytesIO();im.save(out,format='PNG');image=base64.b64encode(out.getvalue()).decode();bitmap.close()
   pages.append({'page':i+1,'text':text,'image':image});page.close()
  doc.close();return {'pages':pages,'limitations':'Text from first 20 pages, images from first 4 pages; review page coverage.'}
 import cadquery as cq
 with tempfile.TemporaryDirectory() as tmp:
  assembly=cq.Assembly();parts=[]
  if action=='import':
   target=os.path.join(tmp,'input.step');open(target,'wb').write(base64.b64decode(data['file'],validate=True));model=cq.importers.importStep(target)
   shapes=[(f'part-{i+1}',solid) for i,solid in enumerate(model.solids().vals()[:20])]
   if not shapes:raise ValueError('STEP contains no supported solids')
   imported=[]
   placements={p['id']:p for p in data.get('placements',[])}
   for id,solid in shapes:
    stl=os.path.join(tmp,id+'.stl');cq.exporters.export(solid,stl,tolerance=0.15,angularTolerance=0.2)
    placement=placements.get(id,{'position':[0,0,0],'rotation':[0,0,0]});rotation=placement['rotation'];moved=cq.Workplane('XY').newObject([solid]).rotate((0,0,0),(1,0,0),rotation[0]).rotate((0,0,0),(0,1,0),rotation[1]).rotate((0,0,0),(0,0,1),rotation[2]).translate(tuple(placement['position']));assembly.add(moved,name=id);imported.append(moved.val())
    bb=solid.BoundingBox();parts.append({'id':id,'stl':base64.b64encode(open(stl,'rb').read()).decode(),'volume':solid.Volume(),'valid':solid.isValid(),'bounds':[bb.xlen,bb.ylen,bb.zlen]})
   step=os.path.join(tmp,'assembly.step');assembly.save(step)
   stl=os.path.join(tmp,'assembly.stl');cq.exporters.export(cq.Compound.makeCompound(imported),stl)
   return {'parts':parts,'step':base64.b64encode(open(step,'rb').read()).decode(),'stl':base64.b64encode(open(stl,'rb').read()).decode(),'engine':'CadQuery 2.6.1 / OpenCascade','imported':True}
  if action!='build':raise ValueError('Unsupported operation')
  components=data['components']
  if len(components)>20:raise ValueError('At most 20 components')
  placed=[]
  for p in components:
   d=p['dimensions'];shape=p['shape'];id=p['id']
   def dim(k):
    v=d.get(k)
    if not isinstance(v,(int,float)) or not math.isfinite(v) or not 0<v<=2000:raise ValueError('Missing or invalid dimension '+k)
    return v
   if shape=='box':model=cq.Workplane('XY').box(dim('length'),dim('width'),dim('height'))
   elif shape in ['cylinder','tube']:
    outer=dim('diameter')/2;wp=cq.Workplane('XY').circle(outer)
    if shape=='tube':
     inner=dim('innerDiameter')/2
     if inner>=outer:raise ValueError('Inner diameter must be smaller than outer diameter')
     wp=wp.circle(inner)
    model=wp.extrude(dim('length')).translate((0,0,-dim('length')/2))
   else:raise ValueError('Unsupported parametric shape')
   solid=model.val()
   if not solid.isValid():raise ValueError('Invalid solid')
   stl=os.path.join(tmp,id+'.stl');cq.exporters.export(model,stl,tolerance=0.15,angularTolerance=0.2)
   position=p.get('position',[0,0,0]);rotation=p.get('rotation',[0,0,0]);loc=cq.Location(cq.Vector(*position),cq.Vector(0,0,1),0)
   # Explicit Euler transforms, no inferred mechanical constraints.
   moved=model.rotate((0,0,0),(1,0,0),rotation[0]).rotate((0,0,0),(0,1,0),rotation[1]).rotate((0,0,0),(0,0,1),rotation[2]).translate(tuple(position))
   assembly.add(moved,name=id);placed.append(moved.val())
   bb=solid.BoundingBox();parts.append({'id':id,'stl':base64.b64encode(open(stl,'rb').read()).decode(),'volume':solid.Volume(),'valid':solid.isValid(),'bounds':[bb.xlen,bb.ylen,bb.zlen]})
  if not parts:raise ValueError('No fully dimensioned components')
  step=os.path.join(tmp,'assembly.step');assembly.save(step)
  stl=os.path.join(tmp,'assembly.stl');cq.exporters.export(cq.Compound.makeCompound(placed),stl,tolerance=0.15,angularTolerance=0.2)
  return {'parts':parts,'step':base64.b64encode(open(step,'rb').read()).decode(),'stl':base64.b64encode(open(stl,'rb').read()).decode(),'engine':'CadQuery 2.6.1 / OpenCascade','units':'mm','limitations':'Primitive parametric reconstruction; assembly placement is user-defined, not a solved mechanical joint system.'}

if __name__=='__main__':
 try:
  data=json.loads(sys.stdin.read(12000000));result=run(data);print(json.dumps(result))
 except Exception as e:
  print(json.dumps({'error':str(e)[:300]}));sys.exit(1)
