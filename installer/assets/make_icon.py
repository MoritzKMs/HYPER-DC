from PIL import Image, ImageDraw
im = Image.new('RGBA', (256,256))
d = ImageDraw.Draw(im)
d.rounded_rectangle((8,8,248,248),54,fill='#141414')
d.polygon([(72,45),(115,45),(102,106),(142,106),(155,45),(198,45),(163,211),(120,211),(134,147),(94,147),(80,211),(37,211)],fill='#fc7045')
d.polygon([(187,184),(217,184),(217,211),(181,211)], fill='#eee8de')
im.save('installer/assets/hyperdc.png')
im.save('installer/assets/hyperdc.ico', sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
