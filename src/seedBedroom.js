require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');

const bedroomProducts = [
  {
    name: 'دريسنج خشب MDF أبيض',
    price: 1000,
    category: 'bedroom',
    stock: 999999,
    images: ['https://res.cloudinary.com/dv6fig2ci/image/upload/v1782479880/Screenshot_2026-06-26_161250_ppiakd.png'],
    description: 'دريسنج مصنوع من خشب MDF عالي الجودة بتشطيب مطفي باللون الأبيض، مزود بعدة أرفف وشماعات لتنظيم الملابس. تصميم عملي وعصري بمقاس 220×200×50 سم، صناعة مصرية.'
  },
  {
    name: 'غرفة نوم خشب مُصنع اتحاد أوروبي 5 قطع - بيج',
    price: 1000,
    category: 'bedroom',
    stock: 999999,
    images: ['https://res.cloudinary.com/dv6fig2ci/image/upload/v1782479857/Screenshot_2026-06-26_161300_uxqocq.png'],
    description: 'غرفة نوم كاملة مكونة من 5 قطع تشمل سرير كينج، دولاب، تسريحة، مرآة، وكومود. مصنوعة من خشب اتحاد أوروبي بتشطيب أنيق باللون البيج، مع ألواح سرير من الخشب الموسكي. تتميز بتصميم عصري وضمان لمدة سنة.'
  },
  {
    name: 'دولاب خشب اتحاد أوروبي ضلفة أبيض',
    price: 2500,
    category: 'bedroom',
    stock: 999999,
    images: ['https://res.cloudinary.com/dv6fig2ci/image/upload/v1782479949/Screenshot_2026-06-26_161312_dixj29.png'],
    description: 'دولاب ملابس مصنوع من خشب اتحاد أوروبي باللون الأبيض، مقاس 80×40×176 سم. يحتوي على أربعة أرفف في الضلفة اليمنى، ورف وشماعة في الضلفة اليسرى، ويوفر مساحة عملية لتنظيم الملابس.'
  },
  {
    name: 'تسريحة MDF بيج وأبيض',
    price: 2000,
    category: 'bedroom',
    stock: 999999,
    images: ['https://res.cloudinary.com/dv6fig2ci/image/upload/v1782480002/Screenshot_2026-06-26_161350_kc5jha.png'],
    description: 'تسريحة أنيقة مصنوعة من خشب MDF باللونين البيج والأبيض، مزودة بدرجين علويين وثلاثة أدراج سفلية لتوفير مساحة تخزين كبيرة. المقاس 140×120×40 سم، صناعة مصرية مع ضمان سنة.'
  },
  {
    name: 'دولاب خشب اتحاد أوروبي 3 ضلفة أبيض',
    price: 3000,
    category: 'bedroom',
    stock: 999999,
    images: ['https://res.cloudinary.com/dv6fig2ci/image/upload/v1782479889/Screenshot_2026-06-26_161402_zpjpll.png'],
    description: 'دولاب ملابس ثلاثي الضلف مصنوع من خشب اتحاد أوروبي بتشطيب أبيض. يحتوي على ضلفتين مزودتين بأرفف وضلفة ثالثة تحتوي على رف وشماعة، بمقاس 200×160×50 سم وتصميم عملي يناسب غرف النوم الحديثة.'
  },
  {
    name: 'سرير فردي خشب MDF 100×200 سم - بيج',
    price: 5000,
    category: 'bedroom',
    stock: 999999,
    images: ['https://res.cloudinary.com/dv6fig2ci/image/upload/v1782479919/Screenshot_2026-06-26_161409_rnqwjp.png'],
    description: 'سرير فردي مصنوع من خشب MDF بتنجيد قطيفة وجاكوار باللون البيج، مزود بألواح سرير من الخشب الموسكي وإسفنج كثافة 33. المقاس 100×200×120 سم، يحتاج إلى تركيب، صناعة مصرية.'
  },
  {
    name: 'دريسنج MDF أسود وبيج',
    price: 2000,
    category: 'bedroom',
    stock: 999999,
    images: ['https://res.cloudinary.com/dv6fig2ci/image/upload/v1782479879/Screenshot_2026-06-26_161418_vfnnso.png'],
    description: 'دريسنج فاخر مصنوع من خشب MDF باللونين الأسود والبيج، مزود بأدراج وأرفف متعددة مع إضاءة داخلية (بدون تركيب). المقاس 210×220×45×40 سم، تصميم عصري يوفر مساحة تخزين كبيرة.'
  },
  {
    name: 'دولاب MDF بابين بيج',
    price: 1500,
    category: 'bedroom',
    stock: 999999,
    images: ['https://res.cloudinary.com/dv6fig2ci/image/upload/v1782480004/Screenshot_2026-06-26_161528_wqgd0r.png'],
    description: 'دولاب ملابس مصنوع من خشب MDF باللون البيج، مزود ببابين مع مرآة أمامية. يحتوي على شماعة و5 أرفف داخلية لتنظيم الملابس، بمقاس 220×180×50 سم.'
  },
  {
    name: 'سرير فردي خشب MDF وقطيفة بيج 120×200 سم',
    price: 4500,
    category: 'bedroom',
    stock: 999999,
    images: ['https://res.cloudinary.com/dv6fig2ci/image/upload/v1782480067/Screenshot_2026-06-26_161534_lsr0im.png'],
    description: 'سرير فردي مصنوع من خشب MDF ومغطى بقماش القطيفة باللون البيج، مزود بإسفنج عالي الكثافة وألواح سرير من الخشب الموسكي. المقاس 120×200×120 سم، تصميم مريح وأنيق.'
  },
  {
    name: 'غرفة نوم خشب اتحاد أوروبي بني ورمادي - 5 قطع',
    price: 6152,
    category: 'bedroom',
    stock: 999999,
    images: ['https://res.cloudinary.com/dv6fig2ci/image/upload/v1782480051/Screenshot_2026-06-26_161542_ffu8zj.png'],
    description: 'غرفة نوم مكونة من 5 قطع تشمل سرير كينج، 2 كومود، تسريحة، ودولاب. مصنوعة من خشب اتحاد أوروبي بتشطيب باللونين البني والرمادي، تتميز بتصميم عصري وجودة تصنيع عالية.'
  },
  {
    name: 'تسريحة خشب MDF أبيض',
    price: 1919,
    category: 'bedroom',
    stock: 999999,
    images: ['https://res.cloudinary.com/dv6fig2ci/image/upload/v1782480094/Screenshot_2026-06-26_161549_jtvcz6.png'],
    description: 'تسريحة مصنوعة من خشب MDF مع أرجل من خشب الزان، مطلية بدهان دوكو باللون الأبيض. مزودة بمرآة كبيرة، بمقاس 75×150×45 سم، تصميم أنيق يناسب غرف النوم الحديثة.'
  },
  {
    name: 'غرفة نوم MDF بني - 5 قطع',
    price: 5996,
    category: 'bedroom',
    stock: 999999,
    images: ['https://res.cloudinary.com/dv6fig2ci/image/upload/v1782480103/Screenshot_2026-06-26_161556_hbjqzn.png'],
    description: 'غرفة نوم كاملة مكونة من سرير كينج، 2 كومود، تسريحة، ودولاب. مصنوعة من خشب MDF باللون البني، مزودة بـ8 ألواح سرير من الخشب الموسكي، تجمع بين التصميم العصري والمتانة.'
  }
];

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const flatProducts = bedroomProducts.flat();
    for (const p of flatProducts) {
      await new Product(p).save();
    }
    console.log(`✅ تم إضافة ${bedroomProducts.length} منتج في تصنيف غرفة النوم`);

    process.exit(0);
  } catch (error) {
    console.error('❌ خطأ:', error.message);
    process.exit(1);
  }
};

seed();
