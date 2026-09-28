require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');

const livingRoomProducts = [
 {
  name: 'كنبة سرير خشب زان و قماش كتان - رمادي',
  price: 1640, // حوالي 1,640 ريال سعودي
  category: 'living_room',
  stock: 999999,
  images: ['https://res.cloudinary.com/dv6fig2ci/image/upload/v1782510180/Screenshot_2026-06-27_003849_zgehor.png'],
  description: 'كنبة سرير عملية مصنوعة من خشب الزان الطبيعي ومغطاة بقماش كتان عالي الجودة باللون الرمادي. تتميز بهيكل متين مع إسفنج كثافة 30 يوفر راحة أثناء الجلوس والنوم، وتأتي مع وسادة مرفقة وأرجل خشب زان باللون الأسود. ارتفاع المقعد 45 سم وعمق القاعدة 65 سم، بتصميم عصري يناسب غرف المعيشة ويجمع بين الأناقة والوظائف العملية.'
},{
  name: 'كنبة ركنة و 2 بوف خشب طبيعي و قماش كتان - بيج',
  price: 3377, // حوالي 3,377 ريال سعودي
  category: 'living_room',
  stock: 999999,
  images: ['https://res.cloudinary.com/dv6fig2ci/image/upload/v1782510142/Screenshot_2026-06-27_003902_omyc6z.png'],
  description: 'كنبة ركنة عصرية مصنوعة من الخشب الطبيعي ومغطاة بقماش كتان ناعم باللون البيج، تأتي مع 2 بوف بنفس التصميم. مزودة بإسفنج عالي الكثافة لتوفير أقصى درجات الراحة، بأبعاد 295×265×85 سم وارتفاع 75 سم، وتناسب المساحات الكبيرة وغرف المعيشة الحديثة.'
},{
  name: 'انتريه مودرن خشب زان أحمر و كتان 4 قطع - أوف وايت',
  price: 4113, // حوالي 4,113 ريال سعودي
  category: 'living_room',
  stock: 999999,
  images: ['https://res.cloudinary.com/dv6fig2ci/image/upload/v1782510292/Screenshot_2026-06-27_003928_mnak9n.png'],
  description: 'انتريه مودرن مكون من 4 قطع مصنوع من خشب الزان الأحمر الطبيعي ومغطى بقماش كتان ناعم باللون أوف وايت. يتميز بإسفنج سوفت كثافة 33 لتوفير راحة فائقة، مع تصميم أنيق يناسب غرف المعيشة العصرية ويجمع بين المتانة والفخامة.'
},{
  name: 'كنبة ركنة خشب زان أحمر و كتان - بيج',
  price: 2829, // حوالي 2,829 ريال سعودي
  category: 'living_room',
  stock: 999999,
  images: ['https://res.cloudinary.com/dv6fig2ci/image/upload/v1782510188/Screenshot_2026-06-27_003947_nbme1h.png'],
  description: 'كنبة ركنة أنيقة مصنوعة من خشب الزان الأحمر الطبيعي ومغطاة بقماش كتان ناعم باللون البيج. تتميز بإسفنج كثافة 33 يمنح راحة ممتازة، مع أبعاد 300×200×90 سم وارتفاع 75 سم، وتصميم عصري يناسب مختلف ديكورات غرف المعيشة.'
},{
  name: 'ترابيزة قهوة زجاج وستيل أسود - 80×80×45 سم',
  price: 314, // حوالي 314 ريال سعودي
  category: 'living_room',
  stock: 999999,
  images: ['https://res.cloudinary.com/dv6fig2ci/image/upload/v1782510291/Screenshot_2026-06-27_003956_smqcqu.png'],
  description: 'ترابيزة قهوة عصرية بتصميم أنيق، مصنوعة من سطح زجاج مقوى وهيكل من الستانلس ستيل المطلي بدهان إلكتروستاتيك باللون الأسود. تأتي بمقاس 80×80×45 سم، وتتميز بالمتانة وسهولة التنظيف، لتكون إضافة مثالية لغرف المعيشة الحديثة.'
},{
  name: 'كنبة بمقعدين خشب زان أحمر قماش فوطه - أوف وايت',
  price: 2955, // حوالي 2,955 ريال سعودي
  category: 'living_room',
  stock: 999999,
  images: ['https://res.cloudinary.com/dv6fig2ci/image/upload/v1782510141/Screenshot_2026-06-27_004004_vfdsts.png'],
  description: 'كنبة بمقعدين مصنوعة من خشب الزان الأحمر الطبيعي ومغطاة بقماش فوطه باللون أوف وايت. مزودة بإسفنج كثافة 30 مع وسادتين بحشو فايبر لتوفير راحة مثالية، وهيكل متين يناسب غرف المعيشة ذات الطابع العصري.'
},{
  name: 'انتريه مودرن خشب زان و قطيفة 4 قطع - بيج',
  price: 3574, // حوالي 3,574 ريال سعودي
  category: 'living_room',
  stock: 999999,
  images: ['https://res.cloudinary.com/dv6fig2ci/image/upload/v1782510230/Screenshot_2026-06-27_004016_na5dvl.png'],
  description: 'انتريه مودرن مكون من 4 قطع مصنوع من خشب الزان الطبيعي ومغطى بقماش قطيفة لامع باللون البيج. يتميز بإسفنج كثافة 33 وهيكل قوي مع تصميم عصري يمنح غرف المعيشة مظهرًا فاخرًا وراحة عالية.'
},{
  name: 'كنبة بثلاثة مقاعد خشب زان و كتان - بيج',
  price: 2276, // حوالي 2,276 ريال سعودي
  category: 'living_room',
  stock: 999999,
 images: ['https://res.cloudinary.com/dv6fig2ci/image/upload/v1782510237/Screenshot_2026-06-27_004023_ehtny7.png'],
  description: 'كنبة بثلاثة مقاعد مصنوعة من هيكل خشب الزان الطبيعي ومغطاة بقماش كتان 100% بوليستر باللون البيج. مزودة بطبقة من الإسفنج الناعم والألياف مع وسادتين بحشو فايبر، وتتميز بمقاس 300×80×80 سم لتوفير راحة وأناقة في غرف المعيشة.'
},{
  name: 'كنبة ركنة خشب طبيعي و كتان - رمادي',
  price: 3394, // حوالي 3,394 ريال سعودي
  category: 'living_room',
  stock: 999999,
  images: ['https://res.cloudinary.com/dv6fig2ci/image/upload/v1782510349/Screenshot_2026-06-27_004033_prltom.png'],
  description: 'كنبة ركنة واسعة مصنوعة من الخشب الطبيعي ومغطاة بقماش كتان باللون الرمادي. مزودة بإسفنج عالي الكثافة لتوفير أقصى درجات الراحة، بأبعاد 300×200×85 سم وارتفاع 70 سم، وتصميم عصري يناسب المساحات الكبيرة.'
},{
  name: 'كرسي إسترخاء خشب زان و جلد مقلوب - بني',
  price: 2256, // حوالي 2,256 ريال سعودي
  category: 'living_room',
  stock: 999999,
  images: ['https://res.cloudinary.com/dv6fig2ci/image/upload/v1782510301/Screenshot_2026-06-27_004040_jelu2l.png'],
  description: 'كرسي استرخاء فاخر مصنوع من خشب الزان مع قاعدة حديد باللون الأسود، ومغطى بجلد مقلوب مزود بطبقة قطيفة. يتميز بخاصية الإهتزاز والدوران 360 درجة مع إمكانية فرد الظهر والقدمين، وإسفنج كثافة 33 لتوفير أقصى درجات الراحة.'
},
];

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const flatProducts = livingRoomProducts.flat();
    for (const p of flatProducts) {
      await new Product(p).save();
    }
    console.log(`✅ تم إضافة ${livingRoomProducts.length} منتج في تصنيف غرفة المعيشة`);

    process.exit(0);
  } catch (error) {
    console.error('❌ خطأ:', error.message);
    process.exit(1);
  }
};

seed();
