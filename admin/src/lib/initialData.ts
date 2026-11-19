// ============================================================================
// MG HOME CMS — Seed Initial Data (v2.3.0)
// File: admin/src/lib/initialData.ts
// Extracted from existing index.html and js/config.js
// ============================================================================

import type { BaseSection, DraftSiteSettings, DraftPageMetadata } from '../types/cms';

export const INITIAL_SITE_SETTINGS: DraftSiteSettings = {
  businessNameAr: "إم جي هوم",
  businessNameEn: "MG HOME",
  localPhone: "0538061531",
  countryCode: "966",
  isCountryCodeConfirmed: true,
  instagramUrl: "https://www.instagram.com/mg_home_air_conditioning/",
  instagramHandle: "@mg_home_air_conditioning",
  facebookUrl: "https://www.facebook.com/share/1533Pkhifuh/",
  serviceMessagesAr: {
    default: "مرحبًا، أريد الاستفسار عن خدمات الصيانة لدى MG HOME.",
    split: "مرحبًا MG HOME، أود الاستفسار عن خدمة تركيب / صيانة مكيفات سبليت.",
    duct: "مرحبًا MG HOME، أود الاستفسار عن تمديد وتركيب دكت التكييف المركزي والمخفي.",
    standing: "مرحبًا MG HOME، أود الاستفسار عن خدمات المكيفات الدولابية والستائر الهوائية.",
    copper: "مرحبًا MG HOME، أود الاستفسار عن خدمات تأسيس وتمديد مواسير النحاس (أمريكي / كوري / صيني).",
    copperAmerican: "مرحبًا MG HOME، أود الاستفسار عن تأسيس وتمديد المواسير النحاس الأمريكي.",
    copperKorean: "مرحبًا MG HOME، أود الاستفسار عن تأسيس وتمديد المواسير النحاس الكوري.",
    copperChinese: "مرحبًا MG HOME، أود الاستفسار عن تأسيس وتمديد المواسير النحاس الصيني.",
    washing: "مرحبًا MG HOME، أود الاستفسار عن صيانة الغسالات الأوتوماتيكية وغسالات الصحون.",
    fridge: "مرحبًا MG HOME، أود الاستفسار عن صيانة الثلاجات وأجهزة التبريد.",
    general: "مرحبًا MG HOME، أود الاستفسار عن خدمات الصيانة والفحص الميداني."
  },
  serviceMessagesEn: {
    default: "Hello MG HOME, I would like to inquire about your maintenance services.",
    split: "Hello MG HOME, I would like to inquire about Split AC installation and repair services.",
    duct: "Hello MG HOME, I would like to inquire about Central & Concealed Duct AC installation.",
    standing: "Hello MG HOME, I would like to inquire about Standing AC units and Air Curtains.",
    copper: "Hello MG HOME, I would like to inquire about copper piping installation services (American / Korean / Chinese).",
    copperAmerican: "Hello MG HOME, I would like to inquire about American copper piping installation.",
    copperKorean: "Hello MG HOME, I would like to inquire about Korean copper piping installation.",
    copperChinese: "Hello MG HOME, I would like to inquire about Chinese copper piping installation.",
    washing: "Hello MG HOME, I would like to inquire about Automatic Washing Machine and Dishwasher repairs.",
    fridge: "Hello MG HOME, I would like to inquire about Refrigerator and Cooling repair services.",
    general: "Hello MG HOME, I would like to inquire about field inspection and general maintenance."
  }
};

export const INITIAL_PAGE_METADATA: DraftPageMetadata = {
  slug: 'home',
  titleAr: "MG HOME — لجميع خدمات التكييف والصيانة | AC & Maintenance Services",
  titleEn: "MG HOME — AC & Maintenance Services | Professional Solutions",
  metaDescriptionAr: "MG HOME لجميع خدمات التكييف والصيانة — متخصصون في تركيب وصيانة مكيفات سبليت، تمديد دكت التكييف المركزي، صيانة الغسالات الأوتوماتيكية، والتبريد المنزلي والتجاري.",
  metaDescriptionEn: "MG HOME for comprehensive AC and appliance maintenance: split AC installation, central ducting, automatic washing machine repairs, and commercial refrigeration.",
  ogImageUrl: "assets/logo/mg-home-logo.jpeg"
};

export const INITIAL_SECTIONS: BaseSection[] = [
  // 1. HERO SECTION
  {
    id: "sec-hero-01",
    type: "hero",
    label: "قسم البطل (Hero Section)",
    order: 10,
    isVisible: true,
    anchorId: "hero",
    settings: {
      backgroundVariant: "default",
      paddingTop: "none",
      paddingBottom: "medium"
    },
    content: {
      badgeAr: "خدمات فنية معتمدة وموثوقة",
      badgeEn: "Certified Technical Services",
      titleHighlightAr: "MG HOME",
      titleHighlightEn: "MG HOME",
      titleSuffixAr: "لجميع خدمات التكييف والصيانة",
      titleSuffixEn: "AC & Maintenance Services",
      descriptionAr: "نقدم حلولًا متكاملة في تركيب، صيانة وإصلاح أنظمة التكييف بمختلف أنواعها، صيانة الغسالات الأوتوماتيكية، ومتابعة دوائر التبريد على أيدي فنيين متخصصين لضمان أعلى درجات الكفاءة.",
      descriptionEn: "We provide comprehensive installation, maintenance, and repair solutions for all types of air conditioning, automatic washing machines, and refrigeration systems by specialized technicians.",
      primaryCtaTextAr: "طلب صيانة عبر واتساب",
      primaryCtaTextEn: "Book via WhatsApp",
      primaryCtaWaMessageKey: "default",
      secondaryCtaTextAr: "استكشف الخدمات",
      secondaryCtaTextEn: "Explore Services",
      secondaryCtaTarget: "#services",
      features: [
        {
          id: "feat-1",
          icon: "shield-check",
          textAr: "فنيون متخصصون وخبرة تنفيذ ميدانية",
          textEn: "Specialized Technicians & Field Expertise"
        },
        {
          id: "feat-2",
          icon: "cpu",
          textAr: "فحص دقيق وعناية بسلامة الأجهزة",
          textEn: "Accurate Diagnostics & Appliance Care"
        },
        {
          id: "feat-3",
          icon: "clock",
          textAr: "سرعة استجابة ومواعيد منضبطة",
          textEn: "Fast Response & Prompt Schedule"
        }
      ],
      floatingCard: {
        logoImage: "assets/logo/mg-home-wave-logo.png",
        badgeTitleAr: "جودة التثبيت والتشغيل",
        badgeTitleEn: "Premium Installation",
        badgeSubtitleAr: "توثيق مباشر من مواقع العمل",
        badgeSubtitleEn: "Verified On-Site Workmanship"
      }
    }
  },

  // 2. SERVICES SECTION
  {
    id: "sec-services-02",
    type: "services",
    label: "شبكة الخدمات (Services Grid)",
    order: 20,
    isVisible: true,
    anchorId: "services",
    settings: {
      backgroundVariant: "surface-alt",
      paddingTop: "medium",
      paddingBottom: "medium"
    },
    content: {
      badgeAr: "خدماتنا المعتمدة",
      badgeEn: "Our Certified Services",
      titleAr: "حلول التكييف والصيانة الشاملة",
      titleEn: "Comprehensive AC & Maintenance Solutions",
      descriptionAr: "نقدم خدمات الصيانة والتركيب المتخصصة للقطاع السكني والتجاري بأعلى معايير الدقة والاحتراف.",
      descriptionEn: "Specialized maintenance and installation services for residential and commercial clients with top-tier precision.",
      items: [
        {
          id: "srv-1",
          serviceKey: "split",
          iconName: "snowflake",
          titleAr: "تركيب وصيانة مكيفات سبليت",
          titleEn: "Split AC Installation & Repair",
          descriptionAr: "تركيب الوحدات الداخلية والخارجية باحترافية، تثبيت الحوامل الجدارية، شحن وتعبئة فريون التبريد، ومعالجة تسريبات المياه وتراكم الثلج.",
          descriptionEn: "Professional split unit installation, bracket mounting, freon gas recharging, leak repair, and coil cleaning.",
          bulletsAr: [
            "فحص ضغط الغاز وتنظيف الفلاتر ومجاري التصريف",
            "تركيب متقن مع عزل مواسير النحاس بالكامل"
          ],
          bulletsEn: [
            "Freon pressure check, filter & drain unclogging",
            "Precision mounting with full thermal copper insulation"
          ],
          buttonTextAr: "طلب خدمة مكيفات سبليت",
          buttonTextEn: "Order Split AC Service"
        },
        {
          id: "srv-2",
          serviceKey: "duct",
          iconName: "wind",
          titleAr: "تمديد وتركيب دكت التكييف المركزي",
          titleEn: "Central & Concealed Duct AC",
          descriptionAr: "أعمال تفصيل وتركيب مجاري الهواء (Duct)، تركيب الجريلات الخطية وموزعات الهواء الدائرية للمنازل والمكاتب.",
          descriptionEn: "Air duct fabrication, overhead installation, linear grilles, and diffusers balancing for optimal airflow.",
          bulletsAr: [
            "تفصيل مجاري هواء حلزونية ومربعة بدقة عالية",
            "موازنة توزيع الهواء لتدفق متجانس في الغرف"
          ],
          bulletsEn: [
            "Custom spiral and rectangular ductwork fabrication",
            "Balanced static pressure and smooth room airflow"
          ],
          buttonTextAr: "طلب خدمة أعمال الدكت",
          buttonTextEn: "Order Duct AC Service"
        },
        {
          id: "srv-3",
          serviceKey: "standing",
          iconName: "layers",
          titleAr: "المكيفات الدولابية والستائر الهوائية",
          titleEn: "Standing AC & Air Curtains",
          descriptionAr: "توريد وتركيب المكيفات الدولابية والتجارية للمحلات والمساحات الواسعة، مع تركيب الستائر الهوائية لعزل الأتربة.",
          descriptionEn: "Commercial standing AC units for large halls and storefront air curtains to isolate dust and conserve cooling.",
          bulletsAr: [
            "حلول تبريد فائقة القوة للمحلات والصالات الكبيرة",
            "تركيب ستائر هوائية علوية متوافقة مع الأبواب"
          ],
          bulletsEn: [
            "High-capacity cooling for retail and large halls",
            "Overhead air curtain fitting for clean doorway isolation"
          ],
          buttonTextAr: "طلب خدمة المكيفات الدولابية",
          buttonTextEn: "Order Standing AC Service"
        },
        {
          id: "srv-4",
          serviceKey: "washing",
          iconName: "activity",
          titleAr: "صيانة الغسالات الأوتوماتيكية وغسالات الصحون",
          titleEn: "Washing Machines & Dishwashers",
          descriptionAr: "صيانة شاملة للأعطال الميكانيكية والكهربائية لغسالات الملابس وغسالات الصحون، فحص كروت التحكم ومشاكل التصريف.",
          descriptionEn: "Expert diagnosis and repair for automatic washers and dishwashers, motor bearings, control boards, and drain pumps.",
          bulletsAr: [
            "فك وفحص الأحواض والرشاشات الداخلية والمحرك",
            "صيانة دورات السحب والتصريف وفحص حساسات الماء"
          ],
          bulletsEn: [
            "Drum disassembly, spray arm and motor diagnostics",
            "Water inlet valve and drain pump cycle servicing"
          ],
          buttonTextAr: "طلب صيانة غسالات وصحون",
          buttonTextEn: "Order Washer Service"
        },
        {
          id: "srv-5",
          serviceKey: "fridge",
          iconName: "tool",
          titleAr: "صيانة الثلاجات وأجهزة التبريد",
          titleEn: "Refrigerators & Cooling Systems",
          descriptionAr: "فحص كمبروسرات الثلاجات، استبدال الفلاتر وصمامات الشحن، كشف تسريب الفريون، ومعالجة ضعف التبريد وتراكم الثلج.",
          descriptionEn: "Refrigerator compressor servicing, filter replacement, freon leak detection, thermostat repair, and defrost cycle fixes.",
          bulletsAr: [
            "شحن غاز التبريد بالمقاييس والضغوط المحددة للمصنع",
            "إصلاح سخانات إذابة الثلج وحساسات الحرارة"
          ],
          bulletsEn: [
            "Factory-grade freon recharging and pressure tuning",
            "Defrost heater and thermostat sensor replacement"
          ],
          buttonTextAr: "طلب صيانة ثلاجات وتبريد",
          buttonTextEn: "Order Fridge Service"
        },
        {
          id: "srv-6",
          serviceKey: "general",
          iconName: "check-circle",
          titleAr: "الفحص الميداني والصيانة الوقائية",
          titleEn: "Field Inspection & Preventive Care",
          descriptionAr: "زيارات تشخيصية ميدانية لمعاينة كفاءة عمل منظومة التكييف والأجهزة المنزلية، والتأكد من استهلاك الكهرباء وسلامة الوصلات.",
          descriptionEn: "Comprehensive on-site diagnostics to inspect HVAC efficiency, electrical amperage draw, and prevent costly breakdowns.",
          bulletsAr: [
            "تشخيص فني صادق بدون استبدال قطع غير ضرورية",
            "نصائح عملية للحفاظ على عمر الجهاز وتقليل الاستهلاك"
          ],
          bulletsEn: [
            "Honest technical diagnostics with genuine replacement parts",
            "Actionable recommendations to cut power consumption"
          ],
          buttonTextAr: "طلب زيارة فحص ومعاينة",
          buttonTextEn: "Request Inspection Visit"
        }
      ]
    }
  },

  // 3. COPPER PIPING SECTION
  {
    id: "sec-copper-03",
    type: "copper",
    label: "تمديد وتأسيس النحاس (Copper Piping)",
    order: 30,
    isVisible: true,
    anchorId: "copper-piping",
    settings: {
      backgroundVariant: "default",
      paddingTop: "medium",
      paddingBottom: "medium"
    },
    content: {
      badgeAr: "تمديد وتأسيس التكييف",
      badgeEn: "HVAC Piping & Rough-in",
      titleAr: "تأسيس وتمديد مواسير النحاس",
      titleEn: "Copper Refrigerant Piping Rough-in",
      descriptionAr: "توريد وتمديد مواسير النحاس المعتمدة للمشاريع السكنية والتجارية تحت التأسيس وبأعلى درجات الإتقان. نوفر الأنواع الثلاثة المطلوبة وفق معايير التبريد:",
      descriptionEn: "Supply and professional rough-in of certified copper refrigerant lines for residential and commercial new builds. We provide all 3 standardized grades:",
      types: [
        {
          id: "cop-1",
          tagAr: "الأمريكي الأصلي",
          tagEn: "Genuine American",
          titleAr: "المواسير النحاس الأمريكي",
          titleEn: "American Copper Piping",
          descriptionAr: "مواسير نحاس أصلية بدمغة بلد المنشأ المعتمدة، تتميز بسماكة جدار عالية وتحمل فائق لضغوط الفريون العالية والتمديد المدفون داخل الجدران والأسقف.",
          descriptionEn: "Origin-stamped American copper with heavy-gauge wall thickness engineered for extreme high-pressure R410A systems and buried chases.",
          bulletsAr: [
            "دمغة بلد المنشأ واضحة وموثقة ميدانياً",
            "أعلى كفاءة لتحمل الضغوط في التأسيسات الكبيرة"
          ],
          bulletsEn: [
            "Visible authentic origin stamp documented on site",
            "Maximum pressure rating for heavy commercial rough-in"
          ],
          image: "assets/copper/american-copper-pipe.jpeg",
          waServiceKey: "copperAmerican"
        },
        {
          id: "cop-2",
          tagAr: "الكوري المعتمد",
          tagEn: "Certified Korean",
          titleAr: "المواسير النحاس الكوري",
          titleEn: "Korean Copper Piping",
          descriptionAr: "لفات مواسير نحاسية كورية معتمدة تجمع بين المرونة العالية أثناء الثني والتشكيل والمتانة الممتازة لشبكات التكييف المنزلي والتجاري.",
          descriptionEn: "Certified Korean copper coils combining high tensile flexibility for tight conduit bending with outstanding corrosion resistance.",
          bulletsAr: [
            "لفات متجانسة وسهولة فائقة في التمديد والمسارات",
            "توزيع حراري منتظم وعزل حراري محكم"
          ],
          bulletsEn: [
            "Consistent bend radius and clean route execution",
            "Uniform thermal conductivity with airtight insulation"
          ],
          image: "assets/copper/korean-copper-coils.jpeg",
          waServiceKey: "copperKorean"
        },
        {
          id: "cop-3",
          tagAr: "الصيني الاقتصادي",
          tagEn: "Practical Chinese",
          titleAr: "المواسير النحاس الصيني",
          titleEn: "Chinese Copper Piping",
          descriptionAr: "حل اقتصادي وعملي لمشاريع التمديد مع ضبط المقاسات والسماكات بدقة الفيرنيه الرقمية لضمان التوافق التام مع متطلبات وحدات التكييف.",
          descriptionEn: "Cost-effective, dependable piping solutions verified with digital caliper gauge inspections to ensure precise fitting tolerances.",
          bulletsAr: [
            "قياس دقيق للأقطار والسماكات بأجهزة القياس الرقمية",
            "تكلفة اقتصادية مناسبة لمختلف الاستخدامات"
          ],
          bulletsEn: [
            "Digital caliper diameter and wall gauge verification",
            "Budget-conscious performance for standard installations"
          ],
          image: "assets/copper/chinese-copper-sizing.jpeg",
          waServiceKey: "copperChinese"
        }
      ],
      fieldworkHeader: {
        badgeAr: "معايير التأسيس الميداني",
        badgeEn: "Field Execution Standards",
        titleAr: "التأسيس الجداري واختبار الضغط الميداني",
        titleEn: "Wall Chasing & Nitrogen Pressure Testing",
        subtitleAr: "نوثق كل مرحلة من تكسير وتمديد المسارات داخل الجدران، وتثبيت خراطيم الكهرباء وصرف المكيفات، إلى اختبار ضغط النيتروجين قبل التشطيب النهائي.",
        subtitleEn: "We document every phase: masonry chasing, conduit anchoring, drainage routing, and nitrogen pressure retention testing before final plastering."
      },
      fieldworkCards: [
        {
          id: "field-1",
          titleAr: "تأسيس جداري دقيق",
          titleEn: "Precision In-Wall Chasing",
          image: "assets/copper/copper-piping-wall-roughin-1.jpeg"
        },
        {
          id: "field-2",
          titleAr: "دمج النحاس والكهرباء",
          titleEn: "Copper & Electrical Integration",
          image: "assets/copper/copper-piping-wall-roughin-2.jpeg"
        },
        {
          id: "field-3",
          titleAr: "اختبار الضغط والسلامة",
          titleEn: "Pressure Retention Testing",
          image: "assets/copper/copper-piping-site-installation.jpeg"
        }
      ]
    }
  },

  // 4. GALLERY SECTION
  {
    id: "sec-gallery-04",
    type: "gallery",
    label: "معرض الأعمال الميدانية (Photo Gallery)",
    order: 40,
    isVisible: true,
    anchorId: "gallery",
    settings: {
      backgroundVariant: "surface-alt",
      paddingTop: "medium",
      paddingBottom: "medium"
    },
    content: {
      badgeAr: "توثيق ميداني",
      badgeEn: "On-Site Documentation",
      titleAr: "أعمالنا السابقة",
      titleEn: "Our Portfolio & Previous Work",
      descriptionAr: "صور حقيقية وغير معدلة من مواقع عملنا الميدانية تبرز دقة التركيب وجودة الصيانة المنفذة لعملائنا.",
      descriptionEn: "Unedited authentic captures from our on-site service calls showing the precision and cleanliness of our workmanship.",
      items: [
        {
          id: "ac-split-hall",
          category: "split",
          categoryAr: "تكييف سبليت",
          categoryEn: "Split AC",
          titleAr: "تركيب وتشغيل مكيفات سبليت في صالة كبرى",
          titleEn: "Split AC Installation in Large Hall",
          descAr: "تثبيت احترافي لوحدات سبليت جدارية مع توصيلات مخفية وتوزيع تدفق هواء متوازن.",
          descEn: "Professional split AC wall installation with concealed piping and balanced airflow distribution.",
          image: "assets/maintenance/ac-split-hall-installation.jpeg",
          width: 1440,
          height: 1440
        },
        {
          id: "copper-american-spec",
          category: "copper",
          categoryAr: "مواسير وتأسيس",
          categoryEn: "Copper & Piping",
          titleAr: "تمديد مواسير النحاس الأمريكي الأصلية",
          titleEn: "Certified American Copper Pipe Installation",
          descAr: "توريد وتمديد مواسير النحاس الأمريكي المعتمدة مع العزل الحراري التام لمنع التكثف وهدر التبريد.",
          descEn: "Premium certified American copper piping with full thermal insulation to prevent condensation and loss.",
          image: "assets/copper/american-copper-pipe.jpeg",
          width: 1200,
          height: 900
        },
        {
          id: "copper-wall-roughin-1",
          category: "copper",
          categoryAr: "مواسير وتأسيس",
          categoryEn: "Copper & Piping",
          titleAr: "تأسيس وتمديد مسارات التكييف داخل الجدار",
          titleEn: "In-Wall AC Copper Piping & Drain Chasing",
          descAr: "تكسير هندسي وتمديد خطوط النحاس ومجاري التصريف داخل الجدار قبل اللياسة والتشطيب.",
          descEn: "Precision masonry chasing, copper refrigerant line, and condensate drain installation before plastering.",
          image: "assets/copper/copper-piping-wall-roughin-1.jpeg",
          width: 1200,
          height: 1600
        },
        {
          id: "dishwasher-lg-service",
          category: "washing",
          categoryAr: "غسالات وصحون",
          categoryEn: "Washers & Dishwashers",
          titleAr: "فحص وصيانة غسالة صحون LG Direct Drive",
          titleEn: "LG Direct Drive Dishwasher Diagnostics",
          descAr: "فحص دورات الغسيل الذكية، رشاشات توزيع المياه، ومعالجة أعطال لوحة التحكم والتصريف.",
          descEn: "Smart diagnostic inspection, dual spray arm testing, and drain cycle servicing.",
          image: "assets/maintenance/dishwasher-lg-direct-drive.jpeg",
          width: 1200,
          height: 1200
        },
        {
          id: "ac-duct-technician",
          category: "duct",
          categoryAr: "دكت وتكييف مركزي",
          categoryEn: "Duct & Central AC",
          titleAr: "تفصيل وتركيب مجاري هواء التكييف المركزي",
          titleEn: "Central AC Air Duct Fabrication & Fitting",
          descAr: "أعمال التقطيع واللحام والتثبيت العلوي لدكت التكييف في الموقع بواسطة فنيين متخصصين.",
          descEn: "On-site air duct fabrication, cutting, and overhead suspension by skilled technicians.",
          image: "assets/maintenance/ac-ductwork-fabrication-technician.jpeg",
          width: 1200,
          height: 900
        },
        {
          id: "fridge-compressor-gauge",
          category: "fridge",
          categoryAr: "ثلاجات وتبريد",
          categoryEn: "Refrigeration",
          titleAr: "فحص ضغط كمبروسر الثلاجة وشحن الفريون",
          titleEn: "Fridge Compressor Diagnostics & Freon Recharge",
          descAr: "توصيل ساعات قياس الضغط، كشف تسريب دارة التبريد، وشحن غاز الفريون بدقة لضبط كفاءة التجميد.",
          descEn: "Manifold gauge hookup, refrigerant leak detection, and precision gas recharge for optimal cooling.",
          image: "assets/maintenance/fridge-compressor-service.jpeg",
          width: 1200,
          height: 900
        }
      ]
    }
  },

  // 5. CONTACT SECTION
  {
    id: "sec-contact-05",
    type: "contact",
    label: "التواصل ونموذج الطلب السريع (Contact & Form)",
    order: 50,
    isVisible: true,
    anchorId: "contact",
    settings: {
      backgroundVariant: "default",
      paddingTop: "medium",
      paddingBottom: "medium"
    },
    content: {
      badgeAr: "تواصل سريع ومباشر",
      badgeEn: "Fast Direct Contact",
      titleAr: "نحن في خدمتك دائمًا",
      titleEn: "We Are Always at Your Service",
      descriptionAr: "تواصل معنا مباشرة عبر واتساب لحجز موعد صيانة أو الاستفسار، أو املأ النموذج السريع لتحويل طلبك فوراً.",
      descriptionEn: "Contact us directly via WhatsApp to book a maintenance slot, or submit the quick inquiry form.",
      formTitleAr: "طلب خدمة فوري عبر واتساب",
      formTitleEn: "Instant Service Inquiry via WhatsApp",
      formSubtitleAr: "حدد نوع الخدمة وسنقوم بتحويل طلبك فورًا لمحادثة واتساب مجهزة بالتفاصيل.",
      formSubtitleEn: "Select your required service and your request will be converted into a pre-filled WhatsApp message.",
      workingHoursAr: "يوميًا: 8:00 صباحًا - 10:00 مساءً (الجمعة: 1:00 ظهرًا - 10:00 مساءً)",
      workingHoursEn: "Daily: 8:00 AM - 10:00 PM (Friday: 1:00 PM - 10:00 PM)",
      locationAr: "المملكة العربية السعودية — تغطية شاملة للمشاريع السكنية والتجارية",
      locationEn: "Kingdom of Saudi Arabia — Full residential and commercial coverage"
    }
  }
];
