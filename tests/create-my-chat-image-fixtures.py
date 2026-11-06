"""Generate only synthetic noise PNGs for optional large-input regression (requires Pillow)."""
import random, sys
from pathlib import Path
from PIL import Image
root=Path(sys.argv[1]); root.mkdir(parents=True,exist_ok=True)
im=Image.frombytes("RGB",(2048,2048),random.Random(20261106).randbytes(2048*2048*3))
im.save(root/"large.png")
for size in [1024,768,576]:
    im.resize((size,size),Image.Resampling.LANCZOS).save(root/f"converted-{size}.png")
print("Synthetic PNGs generated. Run UI tests with MY_CHAT_IMAGE_FIXTURES set to this directory.")
