import sharp from 'sharp';import{readFileSync}from'node:fs';
const svg=readFileSync('public/icons/icon.svg');
for(const size of [192,512])await sharp(svg).resize(size,size).png().toFile(`public/icons/icon-${size}.png`);
const mask=svg.toString().replace('rx="112"','rx="0"').replace('<g fill=', '<g transform="translate(76.8 76.8) scale(.7)" fill=');
await sharp(Buffer.from(mask)).png().toFile('public/icons/maskable-512.png');
await sharp(svg).resize(180,180).png().toFile('public/icons/apple-touch-icon.png');
