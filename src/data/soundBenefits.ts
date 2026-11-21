/**
 * NeuroCalm & Fokus — Sound Benefits Knowledge Layer
 * Evidence-based benefits for all 17 sound modalities categorized strictly into:
 * 1. Supported Benefits (established scientific findings)
 * 2. Promising Benefits (encouraging preliminary findings)
 * 3. Potential Benefits (exploratory, plausible experiential findings)
 *
 * All content uses non-medical, accessible, wellness-oriented terminology.
 */

import { SoundscapeId } from '../types/audio';

export type BenefitTier = 'supported' | 'promising' | 'potential';

export interface SoundBenefitItem {
  id: string;
  en: string;
  ar: string;
}

export interface SoundBenefitsEntry {
  soundId: SoundscapeId;
  // Evidence tiers for the 17 ambient, noise, and brainwave modalities
  supported?: SoundBenefitItem[];
  promising?: SoundBenefitItem[];
  potential?: SoundBenefitItem[];
  // Qualitative categories for traditional instrumental relaxation soundscapes
  soundCharacter?: SoundBenefitItem[];
  listeningExperience?: SoundBenefitItem[];
  suitableContexts?: SoundBenefitItem[];
}

export const SOUND_BENEFITS_DATA: Partial<Record<SoundscapeId, SoundBenefitsEntry>> = {
  // ---------------------------------------------------------------------------
  // Nature Soundscapes
  // ---------------------------------------------------------------------------
  rain: {
    soundId: 'rain',
    supported: [
      {
        id: 'rain-sup-1',
        en: 'Acoustic masking: Continuous precipitation broadband spectrum shields against sudden intrusive indoor and outdoor noises.',
        ar: 'حجب الضوضاء: يوفر صوت الهطول المستمر طيفاً صوتياً متوازناً يحجب الأصوات المفاجئة والمشتتة.',
      },
      {
        id: 'rain-sup-2',
        en: 'Autonomic relaxation: Natural rainfall sounds support parasympathetic activation and lower physiological arousal.',
        ar: 'تهدئة الجهاز العصبي: يساعد صوت المطر الطبيعي على خفض التوتر واستعادة الهدوء الداخلي.',
      },
    ],
    promising: [
      {
        id: 'rain-pro-1',
        en: 'Sleep preparation: Steady rainfall ambience promotes faster transitions into initial resting and sleep phases.',
        ar: 'التهيئة للنوم: يدعم الدخول التدريجي في الاسترخاء اللازم لبدء النوم براحة.',
      },
    ],
    potential: [
      {
        id: 'rain-pot-1',
        en: 'Deep focus sanctuary: Gentle rain ambience creates a comforting acoustic barrier for reading and writing.',
        ar: 'تعزيز بيئة التركيز: يصنع مساحة سمعية هادئة تشجع على القراءة والكتابة دون تشتيت.',
      },
    ],
  },

  stream: {
    soundId: 'stream',
    supported: [
      {
        id: 'stream-sup-1',
        en: 'Stress recovery: Flowing freshwater acoustics promote heart-rate deceleration and perceived calm.',
        ar: 'تخفيف التوتر: يسهم صوت خرير الماء في إبطاء نبضات القلب المتسارعة وتعزيز الشعور بالسكينة.',
      },
    ],
    promising: [
      {
        id: 'stream-pro-1',
        en: 'Attentional restoration: Gentle dynamic water flow supports recovery from sustained mental fatigue.',
        ar: 'استعادة النشاط الذهني: تساعد حركة المياه العذبة غير المنتظمة على تجديد طاقة الانتباه المستنفدة.',
      },
    ],
    potential: [
      {
        id: 'stream-pot-1',
        en: 'Creative flow: Soft, non-repeating acoustic ripples encourage associative thinking and unhurried ideation.',
        ar: 'تحفيز التفكير الإبداعي: تتيح التموجات الصوتية المتجددة مساحة ذهنية رحبة للتأمل وتوليد الأفكار.',
      },
    ],
  },

  ocean_waves: {
    soundId: 'ocean_waves',
    supported: [
      {
        id: 'ocean-sup-1',
        en: 'Rhythmic relaxation: Slow rolling wave cycles (~0.1 Hz periodicity) foster autonomic slowing and relaxed breathing.',
        ar: 'استرخاء إيقاعي: يساعد التردد البطيء لتلاطم الأمواج على تنظيم إيقاع التنفس وتهدئة الأعصاب.',
      },
    ],
    promising: [
      {
        id: 'ocean-pro-1',
        en: 'Somatic anxiety dampening: Coastal acoustic environments consistently reduce feelings of physical restlessness.',
        ar: 'تهدئة التوتر الجسدي: تسهم البيئة الصوتية الشاطئية في تقليل الشعور بالقلق والشد العضلي.',
      },
    ],
    potential: [
      {
        id: 'ocean-pot-1',
        en: 'Sleep depth continuity: Broad low-frequency surf dynamics provide a steady backdrop throughout night rest.',
        ar: 'دعم استمرارية النوم: يمنح الهدير الشاطئي المنخفض خلفية صوتية مطمئنة طوال فترات الراحة.',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Environmental Audio
  // ---------------------------------------------------------------------------
  fan: {
    soundId: 'fan',
    supported: [
      {
        id: 'fan-sup-1',
        en: 'Uniform masking: Consistent mechanical airflow drone effectively masks speech transients and street noises.',
        ar: 'حجب صوتي منتظم: يغطي صوت تدفق الهواء الرتيب على المحادثات المجاورة والضوضاء الخارجية.',
      },
    ],
    promising: [
      {
        id: 'fan-pro-1',
        en: 'Sleep maintenance: Continuous drone reduces abrupt awakenings triggered by sudden sporadic indoor sounds.',
        ar: 'استقرار النوم: يقلل الصوت الثابت من احتمالية الاستيقاظ المفاجئ الناتج عن أصوات مفاجئة في المنزل.',
      },
    ],
    potential: [
      {
        id: 'fan-pot-1',
        en: 'Habitual focus cue: Serves as a neutral sensory anchor signaling dedicated study or work periods.',
        ar: 'إشارة معتادة للتركيز: يعمل كمرساة حسية محايدة تنبه العقل لبدء العمل أو القراءة بانتظام.',
      },
    ],
  },

  fireplace: {
    soundId: 'fireplace',
    promising: [
      {
        id: 'fireplace-pro-1',
        en: 'Psychological comfort: Hearth and campfire crackle evokes sensory feelings of safety, warmth, and calm.',
        ar: 'راحة نفسية دافئة: توحي أصوات طقطقة الخشب وشعلات الموقد بالأمان والسكينة المنزلية.',
      },
    ],
    potential: [
      {
        id: 'fireplace-pot-1',
        en: 'Evening decompression: Subtle wood crackles assist emotional transition from work to restful evening hours.',
        ar: 'تفريغ إجهاد المساء: تساعد الأصوات الدافئة على الانتقال بسلاسة من ضغوط العمل إلى راحة المساء.',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Colored Noise
  // ---------------------------------------------------------------------------
  white_noise: {
    soundId: 'white_noise',
    supported: [
      {
        id: 'white-sup-1',
        en: 'Broadband masking: Equal energy per hertz elevates hearing thresholds, neutralizing unpredictable office and home sounds.',
        ar: 'حجب كامل الترددات: تساوي الطاقة الصوتية عبر كافة الترددات يحجب الأصوات غير المتوقعة بفاعلية عالية.',
      },
    ],
    promising: [
      {
        id: 'white-pro-1',
        en: 'Attention stabilization: Stochastic resonance effects can improve task performance in distractible environments.',
        ar: 'تثبيت الانتباه: تسهم الضوضاء العشوائية المتوازنة في تحسين الأداء الذهني في البيئات المليئة بالمشتتات.',
      },
    ],
    potential: [
      {
        id: 'white-pot-1',
        en: 'Auditory neutralizer: Provides an even baseline that softens internal auditory chatter and minor ear ringing.',
        ar: 'تعديل الخلفية السمعية: يمنح خلفية حيادية تخفف من الإحساس بالرنين الطفيف أو الضجيج الداخلي.',
      },
    ],
  },

  pink_noise: {
    soundId: 'pink_noise',
    supported: [
      {
        id: 'pink-sup-1',
        en: 'Sleep stability: Balanced 1/f spectral profile reduces sleep fragmentation and supports slow-wave rest patterns.',
        ar: 'تعزيز جودة النوم: يساعد التوزيع الطيفي المتوازن (1/f) على تقليل تقلبات النوم ودعم مراحله العميقة.',
      },
    ],
    promising: [
      {
        id: 'pink-pro-1',
        en: 'Fatigue-free listening: Natural reduction in high frequencies allows comfortable extended masking without ear strain.',
        ar: 'استماع مريح طويل الأمد: تدرج الصوت الطبيعي يحمي الأذن من الإجهاد خلال جلسات العمل الممتدة.',
      },
      {
        id: 'pink-pro-2',
        en: 'Memory consolidation support: Acoustic pink noise stimulation correlates with stabilized deep-sleep brain rhythms.',
        ar: 'دعم تثبيت الذاكرة: يرتبط الاستماع للضوضاء الوردية أثناء الراحة بتحسن استقرار موجات الدماغ الهادئة.',
      },
    ],
    potential: [
      {
        id: 'pink-pot-1',
        en: 'Steady cognitive endurance: Cultivates prolonged focus without mental over-stimulation.',
        ar: 'استدامة التركيز: يعزز الاستمرار في إنجاز المهام بهدوء دون استثارة عصبية مفرطة.',
      },
    ],
  },

  brown_noise: {
    soundId: 'brown_noise',
    supported: [
      {
        id: 'brown-sup-1',
        en: 'Deep low-frequency masking: Heavy -6 dB/octave attenuation cushions harsh high-frequency environmental disruptions.',
        ar: 'حجب منخفض التردد: يخفف الانحدار الصوتي العميق من حدة الأصوات العالية المزعجة في البيئة المحيطة.',
      },
    ],
    promising: [
      {
        id: 'brown-pro-1',
        en: 'Quieting racing thoughts: Warm, rich low-frequency presence helps individuals with hyperactive thoughts settle into calm.',
        ar: 'تهدئة تسارع الأفكار: يساعد الهدير الدافئ العميق أصحاب العقول المشغولة على تخفيف التوتر الذهني.',
      },
    ],
    potential: [
      {
        id: 'brown-pot-1',
        en: 'Grounded focus: Provides a deeply reassuring acoustic floor that fosters mental grounding and comfort.',
        ar: 'شعور بالثبات والارتكاز: يمنح إحساساً بالأمان والاستقرار النفسي يسهل الاندماج في القراءة الهادئة.',
      },
    ],
  },

  violet_noise: {
    soundId: 'violet_noise',
    promising: [
      {
        id: 'violet-pro-1',
        en: 'Acoustic compensation: +6 dB/octave high-frequency emphasis balances dull or excessively bass-heavy room acoustics.',
        ar: 'موازنة الصوتيات المحيطة: يعوض التركيز على الترددات العالية كتمة الصوت في الغرف المعزولة أو المكتومة.',
      },
    ],
    potential: [
      {
        id: 'violet-pot-1',
        en: 'Alertness boost: Crisp high-frequency shimmer provides a sensory lift during drowsy mid-afternoon energy dips.',
        ar: 'تنشيط اليقظة: يمنح الإيقاع الصوتي العالي نفحة من الانتعاش الذهني عند الشعور بالخمول أو النعاس.',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Brainwave & Tonal Modalities
  // ---------------------------------------------------------------------------
  binaural_delta: {
    soundId: 'binaural_delta',
    promising: [
      {
        id: 'delta-pro-1',
        en: 'Pre-sleep parasympathetic transition: Low-frequency 2.5 Hz dichotic difference supports physical down-regulation before sleep.',
        ar: 'التهيئة للنوم العميق: يساعد فرق التردد البالغ 2.5 هرتز عبر السماعات على إبطاء نشاط الجسم قبل النوم.',
      },
    ],
    potential: [
      {
        id: 'delta-pot-1',
        en: 'Deep somatic relaxation: Encourages body stillness and letting go of accumulated daytime muscular tension.',
        ar: 'استرخاء عضلي عميق: يشجع على سكون الجسد والتخلص من الإجهاد العضلي المتراكم خلال اليوم.',
      },
    ],
  },

  binaural_theta: {
    soundId: 'binaural_theta',
    promising: [
      {
        id: 'theta-pro-1',
        en: 'Anxiety dampening & meditation: 6 Hz beat frequency supports inward-focused stillness and situational stress relief.',
        ar: 'دعم التأمل وتخفيف التوتر: يسهم التردد البالغ 6 هرتز في تعميق الهدوء الذهني وتخفيف القلق العابر.',
      },
    ],
    potential: [
      {
        id: 'theta-pot-1',
        en: 'Reflective daydreaming: Associated with the hypnagogic bridge between conscious thinking and creative imagery.',
        ar: 'استحضار الخيال والتأمل: يرتبط بحالة التفكير الحر والتأمل الهادئ التي تولد الحلول الإبداعية.',
      },
    ],
  },

  binaural_alpha: {
    soundId: 'binaural_alpha',
    supported: [
      {
        id: 'alpha-sup-1',
        en: 'Situational anxiety reduction: Moderate evidence indicates 10 Hz alpha dichotic stimulation reduces acute situational tension.',
        ar: 'تخفيف القلق الموقفي: تدعم الأدلة العلمية دور نبضات ألفا (10 هرتز) في خفض حدة التوتر والانفعال المفاجئ.',
      },
    ],
    promising: [
      {
        id: 'alpha-pro-1',
        en: 'Calm alertness: Cultivates a relaxed yet attentive mental state, ideal for studying without feeling drowsy.',
        ar: 'يقظة هادئة ومتزنة: يساعد على تحقيق توازن مثالي بين الانتباه الواعي والاسترخاء دون نعاس.',
      },
    ],
    potential: [
      {
        id: 'alpha-pot-1',
        en: 'Flow state facilitation: Assists smooth transition into immersive, single-task work sessions.',
        ar: 'تيسير تدفق التركيز: يساعد على الدخول بسلاسة في حالة الانهماك الهادئ مع مهمة واحدة.',
      },
    ],
  },

  binaural_beta: {
    soundId: 'binaural_beta',
    promising: [
      {
        id: 'beta-pro-1',
        en: 'Sustained vigilance: 18 Hz beat frequency assists active working memory retention and visual attention during complex tasks.',
        ar: 'استدامة الانتباه والذاكرة: يسهم تردد 18 هرتز في تعزيز التركيز البصري ودعم الذاكرة أثناء أداء المهام.',
      },
    ],
    potential: [
      {
        id: 'beta-pot-1',
        en: 'Countering mental sluggishness: Provides sensory stimulation that helps overcome afternoon cognitive hesitation.',
        ar: 'التغلب على التردد الذهني: يوفر تحفيزاً سمعياً منشطاً يساعد على إنجاز الأعمال التحليلية النشطة.',
      },
    ],
  },

  binaural_gamma: {
    soundId: 'binaural_gamma',
    promising: [
      {
        id: 'gamma-pro-1',
        en: 'Attentional flexibility: 40 Hz stimulation correlates with sharper task-switching and cognitive feature binding.',
        ar: 'مرونة التفكير والانتباه: ترتبط نبضات 40 هرتز بزيادة سرعة معالجة المعلومات والتنقل بين المتطلبات.',
      },
    ],
    potential: [
      {
        id: 'gamma-pot-1',
        en: 'High-focus synthesis: Plausible support for intense problem-solving sessions requiring rapid pattern recognition.',
        ar: 'تركيز مكثف لحل المعضلات: خيار واعد لجلسات التفكير التي تتطلب استيعاب تفاصيل معقدة بسرعة.',
      },
    ],
  },

  monaural_alpha: {
    soundId: 'monaural_alpha',
    supported: [
      {
        id: 'monaural-sup-1',
        en: 'Direct acoustic modulation: Physical wave interference creates tangible amplitude fluctuations audible through standard speakers.',
        ar: 'تداخل صوتي ملموس: ينتج تماوجاً صوتياً حقيقياً في الهواء يمكن سماعه بوضوح عبر مكبرات الصوت العادية.',
      },
    ],
    promising: [
      {
        id: 'monaural-pro-1',
        en: 'Relaxation without headphones: Delivers steady 10 Hz rhythm without requiring in-ear or over-ear gear.',
        ar: 'استرخاء دون سماعات رأس: يتيح الاستفادة من إيقاع 10 هرتز في الغرفة بشكل مريح وحر.',
      },
    ],
    potential: [
      {
        id: 'monaural-pot-1',
        en: 'Shared space ambient cadence: Sets an unobtrusive, calming rhythmic pace for group study or quiet offices.',
        ar: 'إيقاع هادئ للأماكن المشتركة: يوفر بيئة صوتية لطيفة تناسب المكاتب المشتركة ومساحات القراءة.',
      },
    ],
  },

  isochronic_alpha: {
    soundId: 'isochronic_alpha',
    supported: [
      {
        id: 'iso-alpha-sup-1',
        en: 'Evoked auditory response: Regularly pulsed tones elicit clear, reliable steady-state cortical auditory following responses.',
        ar: 'استجابة سمعية إيقاعية: تؤدي النبضات المنتظمة إلى استجابة عصبية سمعية متزامنة وواضحة في الدماغ.',
      },
    ],
    promising: [
      {
        id: 'iso-alpha-pro-1',
        en: 'Paced concentration: Distinct raised-cosine pulsing creates a steady tempo that anchors focus.',
        ar: 'ضبط إيقاع التركيز: تصنع النبضات المتتالية وزناً إيقاعياً يرسخ الانتباه ويمنع التشتت السريع.',
      },
    ],
    potential: [
      {
        id: 'iso-alpha-pot-1',
        en: 'Distraction barrier: Regular pulses create an engaging auditory foreground that discourages mind-wandering.',
        ar: 'حاجز ضد السهو: تبقي النبضات الإيقاعية الذهن متصلاً باللحظة الحاضرة وتقلل من شرود الفكر.',
      },
    ],
  },

  isochronic_theta: {
    soundId: 'isochronic_theta',
    supported: [
      {
        id: 'iso-theta-sup-1',
        en: 'Auditory cortical entrainment: Continuous 6 Hz pulse trains reliably drive steady low-frequency cortical synchronization.',
        ar: 'تزامن سمعي بطيء: تضبط النبضات المتتالية بتردد 6 هرتز إيقاع التوافق السمعي في الدماغ بانتظام.',
      },
    ],
    promising: [
      {
        id: 'iso-theta-pro-1',
        en: 'Paced relaxation: Slower pulse frequency encourages conscious breathing down-regulation and quiet resting.',
        ar: 'استرخاء موزون: يشجع الإيقاع الهادئ على إبطاء وتيرة التنفس والاستسلام للراحة الواعية.',
      },
    ],
    potential: [
      {
        id: 'iso-theta-pot-1',
        en: 'Introspective stillness: Useful acoustic accompaniment for journaling, reflection, or mindful evening pauses.',
        ar: 'سكون تأملي: رفيق صوتي ملائم لجلسات تدوين المذكرات والتأمل الهادئ في نهاية اليوم.',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Traditional Chinese Instrumental Soundscapes (Qualitative Descriptions)
  // ---------------------------------------------------------------------------
  xiao: {
    soundId: 'xiao',
    soundCharacter: [
      {
        id: 'xiao-char-1',
        en: 'Gentle, sustained bamboo-flute tones with spacious phrasing and natural breath pauses.',
        ar: 'نغمات خيزرانية هادئة وممتدة لناي الشاو، تتميز بمسافات موسيقية واسعة ووقفات تنفسية طبيعية.',
      },
    ],
    listeningExperience: [
      {
        id: 'xiao-exp-1',
        en: 'Some listeners may find its soft, flowing phrases suitable for quiet and reflective moments.',
        ar: 'قد يجد بعض المستمعين في جمله اللحنية الانسيابية والناعمة ملاذاً ملائماً للحظات الهدوء والتأمل الصامت.',
      },
    ],
    suitableContexts: [
      {
        id: 'xiao-ctx-1',
        en: 'Optional background during comfortable breathing, relaxation, or evening wind-down.',
        ar: 'خلفية اختيارية مريحة أثناء تمارين التنفس الهادئ، الاسترخاء، أو تصفية الذهن في المساء.',
      },
    ],
  },

  dizi: {
    soundId: 'dizi',
    soundCharacter: [
      {
        id: 'dizi-char-1',
        en: 'Clear, expressive transverse-flute melodies with recognizable musical phrases.',
        ar: 'ألحان معبرة وصافية لناي الديزي العرضي مع مقاطع وجمل موسيقية واضحة ومميزة.',
      },
    ],
    listeningExperience: [
      {
        id: 'dizi-exp-1',
        en: 'Its more distinct melodic character may appeal to listeners who prefer recognizable instrumental music over subtle ambient textures.',
        ar: 'قد يروق طابعه اللحني الأكثر وضوحاً للمستمعين الذين يفضلون الموسيقى الآلية المحددة على المؤثرات الصوتية المحيطية الهادئة.',
      },
    ],
    suitableContexts: [
      {
        id: 'dizi-ctx-1',
        en: 'Optional listening during relaxed reading, breaks, or personal leisure.',
        ar: 'استماع اختياري أثناء القراءة المريحة، فترات الاستراحة، أو أوقات الفراغ الشخصية.',
      },
    ],
  },

  guqin: {
    soundId: 'guqin',
    soundCharacter: [
      {
        id: 'guqin-char-1',
        en: 'Sparse plucked-string notes, delicate resonance, and long natural decays.',
        ar: 'نبرات وترية متأنية ومتباعدة، ورنين دقيق مع تلاشٍ صوتي طبيعي وممتد للأوتار.',
      },
    ],
    listeningExperience: [
      {
        id: 'guqin-exp-1',
        en: 'Its spacious, unhurried musical character may suit listeners who enjoy quiet instrumental passages.',
        ar: 'قد يلائم طابعه الموسيقي الواسع والمتأني المستمعين الذين يفضلون المقاطع الآلية الهادئة وغير المتسرعة.',
      },
    ],
    suitableContexts: [
      {
        id: 'guqin-ctx-1',
        en: 'Optional background during reflection, quiet rest, or evening relaxation.',
        ar: 'خلفية اختيارية أثناء التأمل الشخصي، الاستراحة الهادئة، أو الاسترخاء المسائي.',
      },
    ],
  },

  guzheng: {
    soundId: 'guzheng',
    soundCharacter: [
      {
        id: 'guzheng-char-1',
        en: 'Flowing plucked-string phrases, resonant decay, and a recognizable repeating melodic motif.',
        ar: 'تموجات وترية منسابة ورنين طبيعي ممتد مع فكرة لحنية متكررة وواضحة.',
      },
    ],
    listeningExperience: [
      {
        id: 'guzheng-exp-1',
        en: 'Its fuller and more flowing musical texture may appeal to listeners who prefer a more continuous instrumental melody.',
        ar: 'قد يناسب نسيجه الموسيقي الأكثر غنى وانسيابية المستمعين الذين يفضلون اللحن الآلي المتواصل.',
      },
    ],
    suitableContexts: [
      {
        id: 'guzheng-ctx-1',
        en: 'Optional background during leisure, relaxed reading, or listening alongside nature soundscapes.',
        ar: 'خلفية اختيارية في أوقات الراحة، القراءة الهادئة، أو للاستماع المرافق للأصوات الطبيعية كالمطر.',
      },
    ],
  },
};

/**
 * Returns the benefits entry for a specific soundscape modality.
 */
export function getSoundBenefits(soundId: SoundscapeId): SoundBenefitsEntry | null {
  return SOUND_BENEFITS_DATA[soundId] ?? null;
}
