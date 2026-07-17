from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'public'/'brand'
NAVY=(13,27,42,255); GOLD=(212,175,55,255); RED=(208,0,0,255); WHITE=(255,255,255,255)
def font(size,bold=False,serif=False):
    name=('georgiab.ttf' if bold else 'georgia.ttf') if serif else ('arialbd.ttf' if bold else 'arial.ttf')
    path=Path('C:/Windows/Fonts')/name
    return ImageFont.truetype(str(path),size) if path.exists() else ImageFont.load_default()
def centered(draw,xy,text,f,fill,spacing=0):
    widths=[draw.textlength(c,font=f) for c in text]; total=sum(widths)+spacing*max(0,len(text)-1); x=xy[0]-total/2
    for c,w in zip(text,widths): draw.text((x,xy[1]),c,font=f,fill=fill,anchor='lm'); x+=w+spacing
def seal(path,signed=False,mono=False):
    s=1600; im=Image.new('RGBA',(s,s),(0,0,0,0)); d=ImageDraw.Draw(im); c=s//2; ink=NAVY
    d.ellipse((35,35,s-35,s-35),fill=WHITE if mono else GOLD); d.ellipse((60,60,s-60,s-60),fill=WHITE if mono else NAVY,outline=ink if mono else (255,237,157,255),width=13); d.ellipse((280,280,s-280,s-280),fill=WHITE,outline=ink if mono else GOLD,width=24); d.ellipse((325,325,s-325,s-325),outline=ink if mono else GOLD,width=7)
    centered(d,(c,155),'ACCÈS CANADA',font(82,True,True),ink if mono else WHITE,5); centered(d,(c,1420),'DOCUMENT OFFICIEL',font(56,True,True),ink if mono else GOLD,3)
    maple=[(800,278),(827,346),(889,312),(873,382),(947,390),(888,437),(933,490),(857,476),(860,553),(800,510),(740,553),(743,476),(667,490),(712,437),(653,390),(727,382),(711,312),(773,346)]
    d.polygon(maple,fill=ink if mono else RED); d.line((800,510,800,576),fill=ink if mono else RED,width=12)
    d.text((790,845),'A',font=font(390,True,True),fill=ink,anchor='rm'); d.text((790,845),'C',font=font(390,True,True),fill=ink if mono else GOLD,anchor='lm')
    d.line((500,980,1100,980),fill=ink if mono else GOLD,width=8); d.ellipse((787,966,813,992),fill=ink if mono else GOLD); centered(d,(c,1050),'VOTRE CHEMIN VERS LE CANADA,',font(42,True),NAVY,2); centered(d,(c,1110),'NOTRE ENGAGEMENT.',font(42,True),NAVY,2)
    for side in (-1,1):
        pts=[]
        for i in range(9):
            y=600+i*65; x=c+side*(565-18*i); pts.append((x,y)); d.ellipse((x-28,y-18,x+28,y+18),fill=ink if mono else GOLD)
        d.line(pts,fill=ink if mono else GOLD,width=12)
    if signed:
        d.rounded_rectangle((210,1180,1390,1325),radius=28,fill=NAVY,outline=GOLD,width=10); centered(d,(c,1255),'SIGNÉ NUMÉRIQUEMENT',font(58,True),WHITE,5)
    im.save(path,optimize=True)
seal(OUT/'seal-official.png'); seal(OUT/'seal-monochrome.png',mono=True); seal(OUT/'seal-signed.png',signed=True)
