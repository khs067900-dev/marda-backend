require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');

const homeDevicesProducts = [
 {
  name: 'تكييف فريش سبليت 1.25 حصان بارد فقط توربو أبيض - R32',
  price: 1404, // بالريال السعودي (تقريبًا)
  category: 'home_devices',
  stock: 9,
  images: [
    'https://res.cloudinary.com/dv6fig2ci/image/upload/v1782511436/Screenshot_2026-06-27_010226_yydass.png'
  ],
  description: 'تكييف سبليت فريش موديل FUFW09C/IW-AG بقدرة 1.25 حصان، يعمل بنظام التبريد فقط، مزود بخاصية Turbo للتبريد السريع، يستخدم غاز التبريد R32 الصديق للبيئة، ويوفر كفاءة تبريد عالية حتى في درجات الحرارة المرتفعة. اللون أبيض، مع ضمان لمدة 5 سنوات.'
},[
  {
    name: 'مكواة ملابس بخار تيفال برو ستايل 2000 وات - أسود',
    price: 568, // بالريال السعودي (تقريبًا)
    category: 'home_devices',
    stock: 1,
    images: ['https://res.cloudinary.com/dv6fig2ci/image/upload/v1782511493/Screenshot_2026-06-27_010232_f4oerv.png'],
    description: 'مكواة ملابس بخار تيفال برو ستايل موديل IT3480، بقدرة 2000 وات، سعة خزان مياه 1.5 لتر، لون أسود، توفر بخارًا قويًا لإزالة التجاعيد بسهولة مع تصميم عملي للاستخدام اليومي.'
  },
  {
    name: 'قلاية كهربائية بدون زيت فيليبس إيسينشال XL 6.2 لتر 2000 وات - أسود',
    price: 542, // بالريال السعودي (تقريبًا)
    category: 'home_devices',
    stock: 999999,
    images: ['https://res.cloudinary.com/dv6fig2ci/image/upload/v1782511469/Screenshot_2026-06-27_010238_zi1irp.png'],
    description: 'قلاية هوائية فيليبس إيسينشال XL موديل HD9270/90 بسعة 6.2 لتر وقدرة 2000 وات، مزودة بتقنية Rapid Air، شاشة LED، مؤقت، تحكم في درجة الحرارة، وإيقاف تشغيل تلقائي لطهي صحي بقليل من الزيت.'
  },
  {
    name: 'غسالة أطباق بيكو ديجيتال 13 فرد 5 برامج - فضي',
    price: 1457, // بالريال السعودي (تقريبًا)
    category: 'home_devices',
    stock: 999999,
    images: ['https://res.cloudinary.com/dv6fig2ci/image/upload/v1782511479/Screenshot_2026-06-27_010245_gwkhlp.png'],
    description: 'غسالة أطباق بيكو موديل DVN05325X بسعة 13 فرد، 5 برامج، شاشة ديجيتال، خاصية نصف الحمولة، خاصية التعقيم، لون فضي، مع ضمان 5 سنوات.'
  },
  {
    name: 'سخان مياه كهرباء أوليمبيك هيرو تربو 80 لتر - أبيض',
    price: 415, // بالريال السعودي (تقريبًا)
    category: 'home_devices',
    stock: 2,
    images: ['https://res.cloudinary.com/dv6fig2ci/image/upload/v1782511483/Screenshot_2026-06-27_010251_jrybgc.png'],
    description: 'سخان مياه كهربائي أوليمبيك هيرو تربو موديل OYE08021WN بسعة 80 لتر، تسخين أسرع حتى مرتين، شاشة ديجيتال، تحكم في درجة الحرارة، يحافظ على دفء المياه لفترة أطول.'
  },
  {
    name: 'مروحة فريش ستاند شبح 20 بوصة - أسود',
    price: 181, // بالريال السعودي (تقريبًا)
    category: 'home_devices',
    stock: 1,
    images: ['https://res.cloudinary.com/dv6fig2ci/image/upload/v1782511470/Screenshot_2026-06-27_010256_o6yfkj.png'],
    description: 'مروحة فريش ستاند شبح 20 بوصة، موتور قوي وهادئ، سرعة عالية، جهد 220-240 فولت، مزودة بواقي للحماية وطلاء مقاوم للصدأ.'
  },
  {
    name: 'بوتاجاز غاز لاجيرمانيا 5 شعلة 90×60 سم - أسود',
    price: 1854, // بالريال السعودي (تقريبًا)
    category: 'home_devices',
    stock: 1,
    images: ['https://res.cloudinary.com/dv6fig2ci/image/upload/v1782511470/Screenshot_2026-06-27_010302_n5ehgt.png'],
    description: 'بوتاجاز لاجيرمانيا موديل 9M10G4A1X4AWW مقاس 90×60 سم، 5 شعلات غاز إيطالية 100%، شعلة وسطى ثنائية الإشعال، غطاء زجاجي مرآة، لون أسود مع ستانلس ستيل.'
  },
  {
    name: 'خلاط كهربائي كينوود 1000 وات بوعاء زجاجي 2 لتر - أسود وفضي',
    price: 285, // بالريال السعودي (تقريبًا)
    category: 'home_devices',
    stock: 3,
    images: ['https://res.cloudinary.com/dv6fig2ci/image/upload/v1782511497/Screenshot_2026-06-27_010307_rtiadc.png'],
    description: 'خلاط كينوود موديل BLM45.720SS بقدرة 1000 وات، وعاء زجاجي 2 لتر، مطحنة ومفرمة، وظيفة تكسير الثلج، سرعتان مع خاصية النبض، شفرات ستانلس ستيل، ضمان دولي.'
  },
  {
    name: 'ديب فريزر بيكو رأسي نوفروست 404 لتر 8 أدراج - فضي',
    price: 3046, // بالريال السعودي (تقريبًا)
    category: 'home_devices',
    stock: 2,
    images: ['https://res.cloudinary.com/dv6fig2ci/image/upload/v1782511471/Screenshot_2026-06-27_010315_irgmjc.png'],
    description: 'ديب فريزر بيكو رأسي موديل RFNE448E35XB بسعة 404 لتر، نظام No Frost، 8 أدراج، كفاءة طاقة A+، لون فضي، هيكل من الستانلس ستيل البلاتينيوم.'
  }
]
];

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const flatProducts = homeDevicesProducts.flat();
    for (const p of flatProducts) {
      await new Product(p).save();
    }
    console.log(`✅ تم إضافة ${homeDevicesProducts.length} منتج في تصنيف الأجهزة المنزلية`);

    process.exit(0);
  } catch (error) {
    console.error('❌ خطأ:', error.message);
    process.exit(1);
  }
};

seed();
