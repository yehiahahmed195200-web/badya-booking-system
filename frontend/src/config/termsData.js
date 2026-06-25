export const TERMS_VERSION = "1.0";
export const TERMS_EFFECTIVE_DATE = "June 25, 2026";
export const TERMS_LAST_UPDATED = "June 25, 2026";

export const termsData = [
  {
    id: "general_rules",
    category: {
      en: "General Rules",
      ar: "إرشادات عامة"
    },
    icon: "📋",
    items: [
      {
        id: "intro",
        title: {
          en: "Introduction & Compliance",
          ar: "مقدمة والالتزام بالقوانين"
        },
        content: {
          en: "The sports center operates under a set of rules to ensure fairness, safety, and proper facility usage. Every student must comply with these regulations.",
          ar: "يعمل المركز الرياضي بموجب مجموعة من القواعد لضمان العدالة والسلامة والاستخدام السليم للمرافق. يجب على كل طالب الالتزام بهذه اللوائح."
        },
        keywords: ["fairness", "safety", "comply", "compliance", "regulations", "rules", "سلامة", "عدالة", "التزام", "قوانين"]
      },
      {
        id: "court_nets",
        title: {
          en: "Court Net Regulations",
          ar: "لوائح شباك الملاعب"
        },
        content: {
          en: "Do not touch or hang clothes on court nets.",
          ar: "يمنع منعاً باتاً لمس شباك الملاعب أو تعليق الملابس عليها."
        },
        keywords: ["nets", "clothes", "hang", "touch", "shabak", "شباك", "ملابس", "لمس"]
      },
      {
        id: "active_booking_entry",
        title: {
          en: "Active Court Access Restrictions",
          ar: "قيود الدخول للملاعب النشطة"
        },
        content: {
          en: "Students may not enter a court while another booking is active.",
          ar: "لا يجوز للطلاب دخول الملعب أثناء وجود حجز نشط لطالب آخر."
        },
        keywords: ["active", "enter", "another", "booking", "court", "دخول", "ملعب", "نشط", "حجز"]
      },
      {
        id: "equipment_collection",
        title: {
          en: "Sports Equipment Collection",
          ar: "استلام الأدوات الرياضية"
        },
        content: {
          en: "Sports equipment must be collected from the Activity Center before play.",
          ar: "يجب استلام الأدوات الرياضية من مركز النشاط (Activity Center) قبل بدء اللعب."
        },
        keywords: ["equipment", "collect", "activity", "center", "sports", "أدوات", "استلام", "مركز النشاط", "رياضة"]
      },
      {
        id: "equipment_return",
        title: {
          en: "Sports Equipment Return",
          ar: "إعادة الأدوات الرياضية"
        },
        content: {
          en: "Equipment must be returned immediately after the booking ends.",
          ar: "يجب إعادة الأدوات الرياضية فور انتهاء فترة الحجز المحددة."
        },
        keywords: ["equipment", "return", "immediately", "end", "إرجاع", "أدوات", "انتهاء", "فوراً"]
      },
      {
        id: "equipment_transfer_restriction",
        title: {
          en: "Equipment Transfer Restrictions",
          ar: "قيود نقل أو ترك الأدوات"
        },
        content: {
          en: "Equipment must not be left on the court or handed directly to another student.",
          ar: "يجب عدم ترك الأدوات الرياضية في الملعب أو تسليمها مباشرة لطالب آخر."
        },
        keywords: ["hand", "transfer", "leave", "court", "another", "student", "ترك", "تسليم", "طالب", "ملعب"]
      }
    ]
  },
  {
    id: "violations",
    category: {
      en: "Violations & Penalties",
      ar: "المخالفات والجزاءات"
    },
    icon: "⚠️",
    items: [
      {
        id: "v_late_arrival",
        title: {
          en: "Late Arrival Penalty",
          ar: "عقوبة التأخر عن الموعد"
        },
        description: {
          en: "Arriving late for your scheduled court booking.",
          ar: "التأخر في الحضور وحجز الملعب في الوقت المحدد له."
        },
        timeline: {
          first: {
            title: { en: "First Offense", ar: "المخالفة الأولى" },
            penalty: { en: "Written warning", ar: "إنذار كتابي" },
            severity: "warning"
          },
          second: {
            title: { en: "Second Offense", ar: "المخالفة الثانية" },
            penalty: { en: "Suspension for 3 days from all sports facilities", ar: "إيقاف لمدة 3 أيام من دخول كافة الملاعب" },
            severity: "suspension"
          },
          repeated: {
            title: { en: "Repeated Violations", ar: "المخالفات المتكررة" },
            penalty: { en: "Suspension for one academic month", ar: "إيقاف لمدة شهر أكاديمي كامل" },
            severity: "severe"
          }
        },
        keywords: ["late", "arrival", "offense", "warning", "suspension", "month", "تأخير", "حضور", "إنذار", "إيقاف", "شهر"]
      },
      {
        id: "v_damaging_equipment",
        title: {
          en: "Damaging Equipment Penalty",
          ar: "عقوبة إتلاف الأدوات والمعدات"
        },
        description: {
          en: "Damaging courts, nets, rackets, or any sports center properties.",
          ar: "التسبب في إتلاف الملاعب، الشباك، المضارب، أو أي من ممتلكات المركز الرياضي."
        },
        timeline: {
          first: {
            title: { en: "Financial Liability", ar: "المسؤولية المالية" },
            penalty: { en: "Student must repair or replace damaged equipment at their expense", ar: "يجب على الطالب إصلاح أو استبدال المعدات التالفة على نفقته الخاصة" },
            severity: "warning"
          },
          second: {
            title: { en: "Temporary Restriction", ar: "التقييد المؤقت" },
            penalty: { en: "Temporary suspension from sports facilities", ar: "إيقاف مؤقت من استخدام المنشآت الرياضية" },
            severity: "suspension"
          },
          repeated: {
            title: { en: "Severe Misconduct", ar: "إتلاف جسيم أو متكرر" },
            penalty: { en: "Suspension for half an academic year for severe/repeated damage", ar: "إيقاف لمدة نصف عام أكاديمي في حالات الإتلاف الجسيم أو المتكرر" },
            severity: "severe"
          }
        },
        keywords: ["damage", "equipment", "repair", "replace", "financial", "year", "تلف", "إتلاف", "إصلاح", "استبدال", "عام", "أدوات"]
      },
      {
        id: "v_exceeding_players",
        title: {
          en: "Exceeding Maximum Players Penalty",
          ar: "عقوبة تجاوز العدد الأقصى للاعبين"
        },
        description: {
          en: "Bringing more players to the court than the designated sport limit.",
          ar: "إدخال عدد لاعبين للملعب أكبر من الحد الأقصى المسموح به للرياضة المحددة."
        },
        timeline: {
          first: {
            title: { en: "First Offense", ar: "المخالفة الأولى" },
            penalty: { en: "Written warning", ar: "إنذار كتابي" },
            severity: "warning"
          },
          second: {
            title: { en: "Second Offense", ar: "المخالفة الثانية" },
            penalty: { en: "3-day suspension from all sports facilities", ar: "إيقاف لمدة 3 أيام من دخول كافة الملاعب" },
            severity: "suspension"
          },
          repeated: {
            title: { en: "Repeated Violations", ar: "المخالفات المتكررة" },
            penalty: { en: "Suspension for up to one academic month", ar: "إيقاف يصل إلى شهر أكاديمي كامل" },
            severity: "severe"
          }
        },
        keywords: ["players", "exceeding", "maximum", "warning", "suspension", "لاعبين", "تجاوز", "أقصى", "إنذار", "إيقاف"]
      },
      {
        id: "v_offensive_language",
        title: {
          en: "Offensive Language Penalty",
          ar: "عقوبة الألفاظ الخارجة أو السلوك غير اللائق"
        },
        description: {
          en: "Using offensive or abusive language toward fellow students or center staff.",
          ar: "استخدام ألفاظ خارجة أو مسيئة تجاه زملائك من الطلاب أو موظفي المركز الرياضي."
        },
        timeline: {
          first: {
            title: { en: "Immediate Suspension", ar: "إيقاف فوري" },
            penalty: { en: "Suspension from sports facilities for one month", ar: "إيقاف من دخول المنشآت الرياضية لمدة شهر كامل" },
            severity: "warning"
          },
          second: {
            title: { en: "Disciplinary Referral", ar: "لجنة الانضباط" },
            penalty: { en: "Referral to the university disciplinary committee", ar: "الإحالة الفورية إلى مجلس الانضباط بالجامعة" },
            severity: "suspension"
          },
          repeated: {
            title: { en: "Severe Action", ar: "إجراءات مشددة" },
            penalty: { en: "Suspension for half an academic year + additional actions", ar: "إيقاف لنصف عام أكاديمي مع الاحتفاظ بحق تطبيق عقوبات إضافية" },
            severity: "severe"
          }
        },
        keywords: ["language", "offensive", "staff", "students", "disciplinary", "committee", "ألفاظ", "خارجة", "إهانة", "طالب", "مجلس انضباط"]
      },
      {
        id: "v_physical_fighting",
        title: {
          en: "Physical Fighting Penalty",
          ar: "عقوبة التشابك بالأيدي أو المشاجرات"
        },
        description: {
          en: "Engaging in physical fights or violent encounters inside the facilities.",
          ar: "الاشتباك الجسدي أو التورط في مشاجرات وعنف داخل المنشآت الرياضية."
        },
        timeline: {
          first: {
            title: { en: "Immediate Referral", ar: "إحالة فورية" },
            penalty: { en: "Immediate referral to the disciplinary committee", ar: "إحالة فورية مباشرة إلى مجلس الانضباط بالجامعة" },
            severity: "warning"
          },
          second: {
            title: { en: "Suspension Block", ar: "إيقاف طويل الأمد" },
            penalty: { en: "Suspension for up to half an academic year", ar: "إيقاف يصل إلى نصف عام أكاديمي كامل" },
            severity: "suspension"
          },
          repeated: {
            title: { en: "Extra Action", ar: "عقوبات إدارية إضافية" },
            penalty: { en: "Permanent ban possibility or admin additional penalties", ar: "إمكانية الحظر الدائم أو تطبيق عقوبات إضافية تراها الإدارة مناسبة" },
            severity: "severe"
          }
        },
        keywords: ["fight", "fighting", "physical", "violence", "disciplinary", "ban", "خناق", "ضرب", "مشاجرة", "عنف", "مجلس انضباط", "حظر"]
      },
      {
        id: "v_food_drinks",
        title: {
          en: "Food & Drinks Inside Courts Penalty",
          ar: "عقوبة إدخال المأكولات والمشروبات للملاعب"
        },
        description: {
          en: "Bringing food or sugary beverages inside active playing courts (Water is allowed).",
          ar: "إدخال مأكولات أو مشروبات سكرية أو غازية إلى أرضية الملاعب (يسمح بمياه الشرب فقط)."
        },
        timeline: {
          first: {
            title: { en: "First Offense", ar: "المخالفة الأولى" },
            penalty: { en: "Written warning", ar: "إنذار كتابي" },
            severity: "warning"
          },
          second: {
            title: { en: "Second Offense", ar: "المخالفة الثانية" },
            penalty: { en: "3-day suspension from all sports facilities", ar: "إيقاف لمدة 3 أيام من دخول كافة الملاعب" },
            severity: "suspension"
          },
          repeated: {
            title: { en: "Repeated Violations", ar: "المخالفات المتكررة" },
            penalty: { en: "Suspension for up to one academic month", ar: "إيقاف يصل إلى شهر أكاديمي كامل" },
            severity: "severe"
          }
        },
        keywords: ["food", "drinks", "beverages", "courts", "clean", "أكل", "شرب", "مأكولات", "مشروبات", "ملعب", "نظافة"]
      },
      {
        id: "v_improper_shoes",
        title: {
          en: "Improper Sports Shoes Penalty",
          ar: "عقوبة الحذاء الرياضي غير المناسب"
        },
        description: {
          en: "Wearing boots, high heels, casual shoes, or dirty shoes that damage court surfaces.",
          ar: "ارتداء أحذية كعب، أحذية خروج، أو أحذية متسخة تؤدي لإتلاف وتشويه أرضيات الملاعب."
        },
        timeline: {
          first: {
            title: { en: "First Offense", ar: "المخالفة الأولى" },
            penalty: { en: "Written warning", ar: "إنذار كتابي" },
            severity: "warning"
          },
          second: {
            title: { en: "Second Offense", ar: "المخالفة الثانية" },
            penalty: { en: "Temporary suspension (up to one month)", ar: "إيقاف مؤقت يصل إلى شهر كامل" },
            severity: "suspension"
          },
          repeated: {
            title: { en: "Repeated/Severe cases", ar: "الحالات الجسيمة والمتكررة" },
            penalty: { en: "Suspension for half an academic year", ar: "إيقاف لمدة نصف عام أكاديمي كامل" },
            severity: "severe"
          }
        },
        keywords: ["shoes", "shoes", "improper", "damage", "warning", "حذاء", "حذاء رياضي", "غير مناسب", "إنذار", "إيقاف"]
      },
      {
        id: "v_no_booking",
        title: {
          en: "Playing Without Booking Penalty",
          ar: "عقوبة اللعب بدون حجز مسبق"
        },
        description: {
          en: "Using the sports courts without a valid confirmed booking in the system.",
          ar: "استخدام الملاعب للعب دون وجود حجز مؤكد وصحيح على نظام حجز الملاعب."
        },
        timeline: {
          first: {
            title: { en: "First Offense", ar: "المخالفة الأولى" },
            penalty: { en: "Written warning", ar: "إنذار كتابي" },
            severity: "warning"
          },
          second: {
            title: { en: "Facility Removal", ar: "الإخلاء من الملعب" },
            penalty: { en: "Students without a valid booking are immediately removed from courts", ar: "يتم إخلاء الطلاب ومنعهم تماماً من استخدام المرافق فوراً" },
            severity: "suspension"
          },
          repeated: {
            title: { en: "Repeated Violations", ar: "المخالفات المتكررة" },
            penalty: { en: "Suspension from booking privileges for up to one month", ar: "حظر من حجز الملاعب على النظام لمدة تصل لشهور" },
            severity: "severe"
          }
        },
        keywords: ["booking", "without", "confirmed", "valid", "warning", "حجز", "بدون حجز", "لعب عشوائي", "إنذار", "إخلاء"]
      },
      {
        id: "v_smoking",
        title: {
          en: "Smoking Penalty",
          ar: "عقوبة التدخين"
        },
        description: {
          en: "Smoking cigarettes, e-cigarettes, or vapes inside any sports facility or court area.",
          ar: "تدخين السجائر، السجائر الإلكترونية، أو الفيب داخل أي من المرافق والمنشآت الرياضية."
        },
        timeline: {
          first: {
            title: { en: "First Offense", ar: "المخالفة الأولى" },
            penalty: { en: "Suspension from sports facilities for up to one academic month", ar: "إيقاف من المنشآت الرياضية لمدة تصل إلى شهر أكاديمي كامل" },
            severity: "warning"
          },
          second: {
            title: { en: "Repeated Offenses", ar: "المخالفة المتكررة" },
            penalty: { en: "Suspension for half an academic year + referral to university board", ar: "إيقاف لنصف عام أكاديمي كامل وإحالة لإدارة الجامعة" },
            severity: "suspension"
          },
          repeated: {
            title: { en: "Ultimate Suspension", ar: "إجراءات قصوى" },
            penalty: { en: "Subject to permanent exclusion from university sports programs", ar: "عرضة للحرمان الدائم من الأنشطة والفرق الرياضية بالجامعة" },
            severity: "severe"
          }
        },
        keywords: ["smoking", "smoke", "vape", "cigarettes", "suspension", "تدخين", "سجاير", "فيب", "شيشة", "إيقاف", "طرد"]
      }
    ]
  },
  {
    id: "sports_rules",
    category: {
      en: "Booking & Sports Rules",
      ar: "شروط حجز الرياضات"
    },
    icon: "⚽",
    items: [
      {
        id: "s_padel",
        name: { en: "Padel", ar: "البادل" },
        icon: "🎾",
        duration: 60,
        minPlayers: 4,
        maxPlayers: 8,
        rules: {
          en: [
            "Booking cannot start below 4 players.",
            "Booking closes automatically when 8 players is reached.",
            "Players cannot join after match starts."
          ],
          ar: [
            "لا يمكن تفعيل الحجز إذا قل عدد المشتركين عن 4 لاعبين.",
            "يغلق الحجز تلقائياً فور وصول عدد اللاعبين إلى 8 لاعبين.",
            "يمنع انضمام لاعبين جدد بعد بدء المباراة."
          ]
        },
        keywords: ["padel", "tennis", "4", "8", "60", "بادل", "تنس"]
      },
      {
        id: "s_basketball",
        name: { en: "Basketball", ar: "كرة السلة" },
        icon: "🏀",
        duration: 60,
        minPlayers: 6,
        maxPlayers: 10,
        rules: {
          en: [
            "Must be played in 3v3 (min 6 players) or 5v5 (max 10 players) configurations.",
            "Booking requires approval of all primary players.",
            "Matches are limited to 60 minutes."
          ],
          ar: [
            "يجب اللعب بنظام 3 ضد 3 (أقل شيء 6 لاعبين) أو 5 ضد 5 (أقصى شيء 10 لاعبين).",
            "يتطلب الحجز موافقة جميع اللاعبين الأساسيين.",
            "تقتصر المباريات على 60 دقيقة فقط."
          ]
        },
        keywords: ["basketball", "basket", "3v3", "5v5", "6", "10", "سلة", "كرة سلة"]
      },
      {
        id: "s_football",
        name: { en: "Football", ar: "كرة القدم" },
        icon: "⚽",
        duration: 60,
        minPlayers: 8,
        maxPlayers: 15,
        rules: {
          en: [
            "Booking cannot start below 8 players.",
            "Booking closes automatically when 15 players are registered.",
            "Strictly 60 minutes slots."
          ],
          ar: [
            "لا يمكن تفعيل الحجز إذا قل المشتركون عن 8 لاعبين.",
            "يغلق الحجز تلقائياً فور تسجيل 15 لاعباً.",
            "المدة الزمنية للحجز هي 60 دقيقة بدقة."
          ]
        },
        keywords: ["football", "soccer", "8", "15", "60", "قدم", "كرة قدم"]
      },
      {
        id: "s_tennis",
        name: { en: "Tennis", ar: "التنس الأرضي" },
        icon: "🎾",
        duration: 60,
        minPlayers: 2,
        maxPlayers: 4,
        rules: {
          en: [
            "Supports 2 players (Singles) or 4 players (Doubles).",
            "Standard duration is 60 minutes.",
            "Clean non-marking tennis shoes are mandatory."
          ],
          ar: [
            "يسمح باللعب الفردي (لاعبين) أو الزوجي (4 لاعبين).",
            "المدة القياسية للحجز هي 60 دقيقة.",
            "يلتزم اللاعبون بارتداء أحذية تنس نظيفة لا تترك علامات."
          ]
        },
        keywords: ["tennis", "singles", "doubles", "2", "4", "تنس", "أرضي", "فردي", "زوجي"]
      },
      {
        id: "s_volleyball",
        name: { en: "Volleyball", ar: "الكرة الطائرة" },
        icon: "🏐",
        duration: 60,
        minPlayers: 10,
        maxPlayers: 15,
        rules: {
          en: [
            "Booking is auto-confirmed only after reaching 10 players.",
            "Maximum capacity per court booking is 15 players.",
            "Hanging on volleyball nets is strictly prohibited."
          ],
          ar: [
            "يتم تأكيد الحجز تلقائياً فقط بعد وصول عدد اللاعبين إلى 10.",
            "السعة القصوى لحجز الملعب هي 15 لاعباً.",
            "يمنع التعلق بشبكة الطائرة نهائياً."
          ]
        },
        keywords: ["volleyball", "volley", "10", "15", "طائرة", "كرة طائرة"]
      },
      {
        id: "s_table_tennis",
        name: { en: "Table Tennis", ar: "تنس الطاولة" },
        icon: "🏓",
        duration: 30,
        minPlayers: 2,
        maxPlayers: 8,
        rules: {
          en: [
            "Duration limit is 30 minutes to ensure rotation.",
            "Supports 2 to 8 players.",
            "Rackets and balls must be returned immediately after use."
          ],
          ar: [
            "فترة الحجز 30 دقيقة فقط لضمان تدوير اللعب.",
            "تتسع الطاولة لعدد يتراوح بين 2 إلى 8 لاعبين.",
            "يجب إعادة المضارب والكرات فور انتهاء الحجز."
          ]
        },
        keywords: ["table", "tennis", "ping", "pong", "2", "8", "30", "طاولة", "تنس طاولة"]
      },
      {
        id: "s_billiards",
        name: { en: "Billiards", ar: "البلياردو" },
        icon: "🎱",
        duration: 30,
        minPlayers: 2,
        maxPlayers: 4,
        rules: {
          en: [
            "Booking limited to 30 minutes per slot.",
            "Accommodates 2 to 4 players.",
            "Placing drinks or sitting on tables is strictly banned."
          ],
          ar: [
            "يقتصر الحجز على 30 دقيقة للفترة الواحدة.",
            "يسمح باللعب لـ 2 إلى 4 لاعبين.",
            "يمنع منعاً باتاً وضع المشروبات أو الجلوس على الطاولة."
          ]
        },
        keywords: ["billiards", "billiard", "pool", "2", "4", "30", "بلياردو"]
      },
      {
        id: "s_air_hockey",
        name: { en: "Air Hockey", ar: "الهوكي الهوائي" },
        icon: "🏒",
        duration: 30,
        minPlayers: 2,
        maxPlayers: 2,
        rules: {
          en: [
            "Strictly 2 players.",
            "Duration limit is 30 minutes.",
            "Table must not be hit with rackets directly."
          ],
          ar: [
            "العدد المسموح به هو لاعبين اثنين فقط.",
            "فترة اللعب تقتصر على 30 دقيقة.",
            "يمنع ضرب سطح الطاولة بالمضرب بقوة أو إتلافه."
          ]
        },
        keywords: ["air", "hockey", "2", "30", "هوكي", "هوائي"]
      }
    ]
  },
  {
    id: "system_rules",
    category: {
      en: "System Behavior Rules",
      ar: "لوائح سلوك النظام الإلكتروني"
    },
    icon: "⚙️",
    items: [
      {
        id: "sys_confirmation",
        title: {
          en: "Minimum Players Rule",
          ar: "شرط الحد الأدنى للاعبين للتأكيد"
        },
        content: {
          en: "The official booking is confirmed only if the minimum required number of players for the selected sport is reached. The system must reject bookings that do not satisfy the minimum player requirement.",
          ar: "لا يعتبر الحجز رسمياً ومؤكداً إلا عند وصول عدد اللاعبين للحد الأدنى المسموح به للرياضة. يقوم النظام بإلغاء أو رفض الحجوزات التي لا تستوفي هذا الشرط تلقائياً."
        },
        keywords: ["minimum", "players", "reject", "confirmed", "requirement", "حد أدنى", "تأكيد", "رفض", "إلغاء"]
      },
      {
        id: "sys_no_booking_use",
        title: {
          en: "No Use Without Valid Reservation",
          ar: "منع استخدام المنشآت بدون حجز"
        },
        content: {
          en: "Students without a valid, active, and confirmed booking in the system are not allowed to enter or use the sports facilities. Administration staff can request players to show their digital booking passes at any time.",
          ar: "لا يُسمح للطلاب الذين ليس لديهم حجز نشط ومؤكد على النظام بدخول أو استخدام الصالات والملاعب. يحق لمشرفي النشاط طلب إظهار الباركود أو بطاقة الحجز الرقمية في أي وقت."
        },
        keywords: ["valid", "reservation", "staff", "digital", "pass", "دخول", "حجز", "باركود", "موافقة"]
      },
      {
        id: "sys_double_booking",
        title: {
          en: "Double Booking Restriction",
          ar: "منع الحجز المزدوج لنفس الطالب"
        },
        content: {
          en: "A student cannot make more than one active booking in the same hour slot. The system automatically blocks you from scheduling multiple facilities concurrently.",
          ar: "لا يسمح للطالب بعمل أكثر من حجز نشط في نفس الساعة. يقوم النظام تلقائياً بحظرك من حجز ملاعب متعددة في نفس الوقت."
        },
        keywords: ["double", "multiple", "concurrent", "block", "حجز مزدوج", "نفس الموعد", "حظر تلقائي"]
      },
      {
        id: "sys_overlap_prevention",
        title: {
          en: "Booking Overlap Prevention",
          ar: "منع التداخل في أوقات الملاعب"
        },
        content: {
          en: "The system automatically prevents booking overlaps for any single facility slot. A slot is reserved exclusively for the confirmed group, and no concurrent sessions can be confirmed for the same court.",
          ar: "يمنع النظام تداخل المواعيد في أي ملعب. يتم تخصيص الملعب بالكامل للمجموعة صاحب الحجز المؤكد، ولا يسمح بأي تداخل في نفس التوقيت."
        },
        keywords: ["overlap", "prevent", "exclusive", "court", "تداخل", "توقيت", "منع", "تضارب"]
      },
      {
        id: "sys_pre_confirmation_validation",
        title: {
          en: "Pre-Confirmation Validation Check",
          ar: "التحقق المسبق قبل تأكيد الحجز"
        },
        content: {
          en: "All system validations (credits check, warnings quota, overlap constraints, and player boundaries) are executed automatically prior to booking confirmation. Any failure will result in immediate rejection.",
          ar: "تتم عملية التحقق (النقاط، الإنذارات المترتبة، التداخل، وعدد اللاعبين) تلقائياً قبل تأكيد الحجز. أي خلل في الشروط سيؤدي إلى رفض الطلب فوراً."
        },
        keywords: ["validation", "verification", "check", "pre-confirmation", "تحقق", "مسبق", "تأكيد", "فحص"]
      }
    ]
  },
  {
    id: "notices",
    category: {
      en: "Important Disclaimers & Notices",
      ar: "تنبيهات وإخلاء مسؤولية هام"
    },
    icon: "🔔",
    items: [
      {
        id: "n_belongings",
        title: {
          en: "Personal Belongings",
          ar: "الممتلكات الشخصية"
        },
        content: {
          en: "Personal belongings are the sole responsibility of their owners. The university and sports administration accept no liability for lost, stolen, or damaged personal items.",
          ar: "المتعلقات الشخصية هي مسؤولية أصحابها كاملة. لا تتحمل الجامعة أو إدارة النشاط الرياضي أي مسؤولية عن فقدان أو سرقة أو تلف أي متعلقات شخصية."
        },
        keywords: ["personal", "belongings", "lost", "stolen", "responsibility", "liability", "ممتلكات", "شخصية", "مسؤولية", "ضياع", "سرقة"]
      },
      {
        id: "n_admin_rights",
        title: {
          en: "Administrative Disciplinary Rights",
          ar: "حقوق الإدارة في اتخاذ العقوبات"
        },
        content: {
          en: "The administration reserves the right to impose additional disciplinary actions whenever necessary to protect the facility and maintain order. This includes ban extensions, referral to dean offices, or fine assignments.",
          ar: "تحتفظ إدارة النشاط الرياضي بالحق في فرض عقوبات وإجراءات تأديبية إضافية متى لزم الأمر لحماية المنشآت والمحافظة على النظام العام، بما في ذلك إطالة مدة الحظر أو الإحالة لعمادة شؤون الطلاب."
        },
        keywords: ["administration", "disciplinary", "reserve", "rights", "order", "حقوق", "إدارة", "عقوبة", "نظام", "منشآت"]
      },
      {
        id: "n_final_decisions",
        title: {
          en: "Finality of Disciplinary Decisions",
          ar: "نهائية القرارات التأديبية"
        },
        content: {
          en: "All disciplinary actions and committee findings are final and binding. Appeals must be formally routed through the university disciplinary board.",
          ar: "تعتبر جميع العقوبات والقرارات الصادرة عن مجلس الانضباط نهائية وملزمة. يجب تقديم التظلمات رسمياً فقط من خلال القنوات الرسمية لمجلس الجامعة."
        },
        keywords: ["final", "decisions", "appeals", "binding", "قرارات", "نهائية", "مجلس الجامعة", "مجلس الانضباط"]
      }
    ]
  }
];
