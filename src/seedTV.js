require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');

const products = [
  {
  name: 'جنرال سوبريم شاشة 50 بوصة، فائقة الدقة (4K-UHD)، سمارت، نظام ويب او اس، ريموت ذكي',
  description: 'شاشة جنرال سوبريم مقاس 50 بوصة بدقة 4K Ultra HD، نظام WebOS الذكي، ريموت ذكي، جودة صورة عالية مع تصميم أنيق وتجربة مشاهدة مميزة.',
  price: 1299,
  oldPrice: 2899,
  category: 'home_devices',
  subCategory: 'tvs',
  brand: 'General Supreme',
  model: 'GS50WOST',
  stock: 10000,
  warranty: 'سنة واحدة',
  isFeatured: false,
  isBestSeller: true,
  images: [
    'https://res.cloudinary.com/dv6fig2ci/image/upload/v1782926668/Screenshot_2026-07-01_202101_xy4ivc.png'
  ]},

  {
  name: 'جنرال سوبريم شاشة 55 بوصة، فائقة الدقة (4K-UHD)، سمارت، نظام ويب او اس، ريموت ذكي',
  description: 'شاشة جنرال سوبريم 55 بوصة بدقة 4K UHD، نظام WebOS الذكي، ريموت ذكي، بلوتوث، ودعم اتصال الجوال مع جودة صورة وصوت ممتازة.',
  price: 1799,
  oldPrice: 3599,
  category: 'home_devices',
  subCategory: 'tvs',
  brand: 'General Supreme',
  model: 'GS55WOST',
  stock: 5000000,
  warranty: '3 سنوات',
  isFeatured: false,
  isBestSeller: true,
  images: [
'https://res.cloudinary.com/dv6fig2ci/image/upload/v1782926610/Screenshot_2026-07-01_201928_utgyn1.png'
  ],
},


{
  name: 'جولد تك شاشة 65 بوصة، فائقة الدقة (4K-UHD)، سمارت، اندرويد 13',
  description: 'شاشة جولد تك 65 بوصة بدقة 4K UHD تعمل بنظام Android 13 مع تصميم أنيق، صوت قوي، ومنافذ HDMI وUSB متعددة لتجربة ترفيه متكاملة.',
  price: 1699,
  oldPrice: 3229,
  category: 'home_devices',
  subCategory: 'tvs',
  brand: 'Gold Tech',
  model: 'GT65W4K',
  stock: 1000000,
  warranty: 'سنتين',
  isFeatured: false,
  isBestSeller: true,
  images: [
   'https://res.cloudinary.com/dv6fig2ci/image/upload/v1782926585/Screenshot_2026-07-01_201938_cnnjis.png'
  ],
},
{
  name: 'شاشة إل جي QNED 86 بوصة، 4K UHD، سمارت، WebOS، 60Hz',
  description: 'تلفزيون LG QNED AI مقاس 86 بوصة بدقة 4K UHD، معالج Alpha 7 AI Gen8، نظام WebOS 25، ريموت Magic Remote، تقنية HDR10، وألوان QNED الديناميكية.',
  price: 7299,
  oldPrice: 11299,
  category: 'home_devices',
  subCategory: 'tvs',
  brand: 'LG',
  model: 'LG-86QNED82A6A',
  stock: 1000000,
  warranty: 'سنتين',
  isFeatured: true,
  isBestSeller: false,
  images: [
'https://res.cloudinary.com/dv6fig2ci/image/upload/v1782926591/Screenshot_2026-07-01_201949_fli60q.png'
  ],
},


{
  name: 'تي سي إل شاشة 98 بوصة QLED 4K UHD سمارت Google TV 144Hz',
  description: 'شاشة TCL مقاس 98 بوصة بتقنية QLED ودقة 4K UHD، تعمل بنظام Google TV، معدل تحديث 144 هرتز، صوت 40 واط، بلوتوث 5.0، و4 منافذ HDMI.',
  price: 5999,
  oldPrice: 13999,
  category: 'home_devices',
  subCategory: 'tvs',
  brand: 'TCL',
  model: '98P8K',
  stock: 1000000,
  warranty: '3 سنوات',
  isFeatured: true,
  isBestSeller: true,
  images: [
   'https://res.cloudinary.com/dv6fig2ci/image/upload/v1782926601/Screenshot_2026-07-01_201958_hrzk13.png'
  ],
},{
  name: 'إل جي QNED MiniLED شاشة 65 بوصة 4K سمارت WebOS 144Hz',
  description: 'شاشة LG QNED MiniLED مقاس 65 بوصة بدقة 4K، نظام WebOS، معدل تحديث 144 هرتز، بلوتوث، 4 منافذ HDMI و2 منفذ USB مع جودة صورة وصوت فائقة.',
  price: 4399,
  oldPrice: 5999,
  category: 'home_devices',
  subCategory: 'tvs',
  brand: 'LG',
  model: 'LG-65QNED91A6A',
  stock: 500000,
  warranty: 'سنتين',
  isFeatured: true,
  isBestSeller: true,
  images: [
'https://res.cloudinary.com/dv6fig2ci/image/upload/v1782926622/Screenshot_2026-07-01_202019_nnorc4.png'
  ],
},{
  name: 'جنرال سوبريم شاشة 65 بوصة QLED 4K UHD سمارت Google TV Dolby Audio',
  description: 'شاشة جنرال سوبريم QLED مقاس 65 بوصة بدقة 4K UHD، تعمل بنظام Google TV، تدعم Dolby Vision وDolby Audio، Chromecast مدمج، بلوتوث، و4 منافذ HDMI.',
  price: 2699,
  oldPrice: 5299,
  category: 'home_devices',
  subCategory: 'tvs',
  brand: 'General Supreme',
  model: 'GSQG654KC',
  stock: 1000000,
  warranty: '3 سنوات',
  isFeatured: false,
  isBestSeller: true,
  images: [
   'https://res.cloudinary.com/dv6fig2ci/image/upload/v1782926601/Screenshot_2026-07-01_201958_hrzk13.png'
  ],
},{
  name: 'سامسونج شاشة 65 بوصة Neo QLED 4K سمارت Tizen OS 144Hz',
  description: 'شاشة Samsung Neo QLED مقاس 65 بوصة بدقة 4K، تعمل بنظام Samsung Tizen OS، تدعم Dolby Atmos، معدل تحديث 144 هرتز، مع 4 منافذ HDMI و2 منفذ USB.',
  price: 3099,
  oldPrice: 6999,
  category: 'home_devices',
  subCategory: 'tvs',
  brand: 'Samsung',
  model: 'SAM-QA65QN70FAUXSA',
  stock: 100000000,
  warranty: 'سنتين',
  isFeatured: true,
  isBestSeller: true,
  images: [
  'https://res.cloudinary.com/dv6fig2ci/image/upload/v1782926637/Screenshot_2026-07-01_202031_ohm92r.png'
  ],
},{
  name: 'جنرال سوبريم شاشة 50 بوصة 4K UHD سمارت WebOS',
  description: 'شاشة جنرال سوبريم مقاس 50 بوصة بدقة 4K UHD، تعمل بنظام WebOS، بلوتوث، ريموت ذكي، 3 منافذ HDMI و2 منفذ USB.',
  price: 1299,
  oldPrice: 2899,
  category: 'home_devices',
  subCategory: 'tvs',
  brand: 'General Supreme',
  model: 'GS50WOST',
  stock: 1000000,
  warranty: '3 سنوات',
  isFeatured: false,
  isBestSeller: true,
  images: ['https://res.cloudinary.com/dv6fig2ci/image/upload/v1782926860/Screenshot_2026-07-01_202112_hfl7hx.png'
  ],
},{
  name: 'جنرال سوبريم شاشة 50 بوصة 4K UHD سمارت Google TV 60Hz',
  description: 'شاشة جنرال سوبريم مقاس 50 بوصة بدقة 4K UHD، تعمل بنظام Google TV، Chromecast مدمج، بلوتوث 5.0، تصميم بدون حواف، و3 منافذ HDMI.',
  price: 1549,
  oldPrice: 2799,
  category: 'home_devices',
  subCategory: 'tvs',
  brand: 'General Supreme',
  model: 'GSG50C',
  stock: 100000000,
  warranty: '3 سنوات',
  isFeatured: false,
  isBestSeller: true,
  images: [
   'https://res.cloudinary.com/dv6fig2ci/image/upload/v1782926860/Screenshot_2026-07-01_202112_hfl7hx.png'
  ],
},

];

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    for (const p of products) {
      await new Product(p).save();
      console.log(`✅ تم إضافة: ${p.name}`);
    }

    console.log(`\n✅ تم إضافة ${products.length} منتج بنجاح`);
    process.exit(0);
  } catch (error) {
    console.error('❌ خطأ:', error.message);
    process.exit(1);
  }
};

seed();
