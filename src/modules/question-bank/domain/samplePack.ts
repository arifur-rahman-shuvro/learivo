/* Sample questions for a student who has nothing yet. Short, standard textbook facts, tagged "sample" so they are easy to find and delete. */
import type { QuestionInput } from "./model.ts";

export const SAMPLE_TAG = "sample";

export const SAMPLE_QUESTIONS: QuestionInput[] = [
  {
    qtype: "sba",
    stem: "Which nerve is compressed in carpal tunnel syndrome?",
    explanation:
      "The median nerve runs through the carpal tunnel with the flexor tendons. Compression causes tingling in the thumb, index, middle and half of the ring finger.",
    answer: {
      options: [
        {
          text: "Ulnar nerve",
          correct: false,
        },
        {
          text: "Radial nerve",
          correct: false,
        },
        {
          text: "Median nerve",
          correct: true,
        },
        {
          text: "Musculocutaneous nerve",
          correct: false,
        },
        {
          text: "Axillary nerve",
          correct: false,
        },
      ],
    },
    difficulty: 1,
    source: "Learivo sample",
    institution: "",
    examName: "",
    examYear: null,
    path: ["Anatomy"],
    tags: ["sample"],
  },
  {
    qtype: "true_false",
    stem: "About the heart, decide whether each statement is true or false.",
    explanation:
      "The mitral valve has two cusps (it is also called the bicuspid valve). The sinoatrial node lies in the right atrium, near the opening of the superior vena cava.",
    answer: {
      options: [
        {
          text: "The tricuspid valve lies between the right atrium and the right ventricle.",
          correct: true,
        },
        {
          text: "The mitral valve has three cusps.",
          correct: false,
        },
        {
          text: "The pulmonary veins carry oxygenated blood to the left atrium.",
          correct: true,
        },
        {
          text: "The sinoatrial node lies in the wall of the left atrium.",
          correct: false,
        },
        {
          text: "The coronary arteries arise from the ascending aorta.",
          correct: true,
        },
      ],
    },
    difficulty: 2,
    source: "Learivo sample",
    institution: "",
    examName: "",
    examYear: null,
    path: ["Anatomy"],
    tags: ["sample"],
  },
  {
    qtype: "sba",
    stem: "Where in the nephron is most of the filtered water reabsorbed?",
    explanation:
      "About two thirds of the filtered water and sodium is reabsorbed in the proximal convoluted tubule, together with nearly all the filtered glucose and amino acids.",
    answer: {
      options: [
        {
          text: "Proximal convoluted tubule",
          correct: true,
        },
        {
          text: "Descending limb of the loop of Henle",
          correct: false,
        },
        {
          text: "Distal convoluted tubule",
          correct: false,
        },
        {
          text: "Collecting duct",
          correct: false,
        },
        {
          text: "Ascending limb of the loop of Henle",
          correct: false,
        },
      ],
    },
    difficulty: 2,
    source: "Learivo sample",
    institution: "",
    examName: "",
    examYear: null,
    path: ["Physiology"],
    tags: ["sample"],
  },
  {
    qtype: "multi_select",
    stem: "Which of the following increase heart rate? Select all that apply.",
    explanation:
      "Sympathetic activity and adrenaline raise the rate of sinoatrial node firing, and fever raises it too. Vagal stimulation and acetylcholine slow the heart.",
    answer: {
      options: [
        {
          text: "Sympathetic stimulation",
          correct: true,
        },
        {
          text: "Circulating adrenaline",
          correct: true,
        },
        {
          text: "Vagal (parasympathetic) stimulation",
          correct: false,
        },
        {
          text: "Fever",
          correct: true,
        },
        {
          text: "Acetylcholine acting on the sinoatrial node",
          correct: false,
        },
      ],
    },
    difficulty: 2,
    source: "Learivo sample",
    institution: "",
    examName: "",
    examYear: null,
    path: ["Physiology"],
    tags: ["sample"],
  },
  {
    qtype: "fill_blank",
    stem: "During DNA replication, the enzyme that joins Okazaki fragments on the lagging strand is DNA {{1}}.",
    explanation:
      "DNA ligase seals the nicks between Okazaki fragments after the RNA primers are replaced with DNA.",
    answer: {
      blanks: [
        {
          accepted: ["ligase"],
        },
      ],
    },
    difficulty: 2,
    source: "Learivo sample",
    institution: "",
    examName: "",
    examYear: null,
    path: ["Biochemistry"],
    tags: ["sample"],
  },
  {
    qtype: "sba",
    stem: "Which enzyme is the main rate-limiting step of glycolysis?",
    explanation:
      "Phosphofructokinase-1 catalyses the committed step, fructose 6-phosphate to fructose 1,6-bisphosphate. It is inhibited by ATP and citrate and activated by AMP and fructose 2,6-bisphosphate.",
    answer: {
      options: [
        {
          text: "Hexokinase",
          correct: false,
        },
        {
          text: "Phosphofructokinase-1",
          correct: true,
        },
        {
          text: "Pyruvate kinase",
          correct: false,
        },
        {
          text: "Aldolase",
          correct: false,
        },
        {
          text: "Enolase",
          correct: false,
        },
      ],
    },
    difficulty: 3,
    source: "Learivo sample",
    institution: "",
    examName: "",
    examYear: null,
    path: ["Biochemistry"],
    tags: ["sample"],
  },
  {
    qtype: "sba",
    stem: "Reed-Sternberg cells are characteristic of which condition?",
    explanation:
      "Binucleate Reed-Sternberg cells with prominent nucleoli, giving an owl-eye look, are the hallmark of classical Hodgkin lymphoma.",
    answer: {
      options: [
        {
          text: "Burkitt lymphoma",
          correct: false,
        },
        {
          text: "Hodgkin lymphoma",
          correct: true,
        },
        {
          text: "Chronic lymphocytic leukaemia",
          correct: false,
        },
        {
          text: "Multiple myeloma",
          correct: false,
        },
        {
          text: "Follicular lymphoma",
          correct: false,
        },
      ],
    },
    difficulty: 2,
    source: "Learivo sample",
    institution: "",
    examName: "",
    examYear: null,
    path: ["Pathology"],
    tags: ["sample"],
  },
  {
    qtype: "true_false",
    stem: "About acute and chronic inflammation, decide whether each statement is true or false.",
    explanation:
      "Histamine causes vasodilation and increased vascular permeability. Neutrophils arrive first, within hours. Lymphocytes and macrophages dominate chronic inflammation.",
    answer: {
      options: [
        {
          text: "Neutrophils are the main cells of acute inflammation.",
          correct: true,
        },
        {
          text: "Granuloma formation is a feature of chronic inflammation.",
          correct: true,
        },
        {
          text: "Histamine causes vasoconstriction of small vessels at the site of injury.",
          correct: false,
        },
        {
          text: "Redness of acute inflammation is caused by vasodilation.",
          correct: true,
        },
        {
          text: "Lymphocytes are the first cells to arrive in acute inflammation.",
          correct: false,
        },
      ],
    },
    difficulty: 2,
    source: "Learivo sample",
    institution: "",
    examName: "",
    examYear: null,
    path: ["Pathology"],
    tags: ["sample"],
  },
  {
    qtype: "sba",
    stem: "Which drug is the antidote for paracetamol overdose?",
    explanation:
      "N-acetylcysteine replenishes glutathione and binds the toxic metabolite NAPQI. It works best when started within 8 to 10 hours of the overdose.",
    answer: {
      options: [
        {
          text: "Naloxone",
          correct: false,
        },
        {
          text: "Flumazenil",
          correct: false,
        },
        {
          text: "N-acetylcysteine",
          correct: true,
        },
        {
          text: "Atropine",
          correct: false,
        },
        {
          text: "Protamine sulfate",
          correct: false,
        },
      ],
    },
    difficulty: 1,
    source: "Learivo sample",
    institution: "",
    examName: "",
    examYear: null,
    path: ["Pharmacology"],
    tags: ["sample"],
  },
  {
    qtype: "fill_blank",
    stem: "The anticoagulant effect of warfarin is monitored using the {{1}}.",
    explanation:
      "Warfarin blocks vitamin K epoxide reductase, lowering factors II, VII, IX and X. The effect is followed with the prothrombin time, reported as the INR.",
    answer: {
      blanks: [
        {
          accepted: [
            "INR",
            "International Normalised Ratio",
            "International Normalized Ratio",
            "prothrombin time",
            "PT",
          ],
        },
      ],
    },
    difficulty: 2,
    source: "Learivo sample",
    institution: "",
    examName: "",
    examYear: null,
    path: ["Pharmacology"],
    tags: ["sample"],
  },
  {
    qtype: "sba",
    stem: "Which organism is the most common cause of community-acquired pneumonia in adults?",
    explanation:
      "Streptococcus pneumoniae is the most common cause of community-acquired pneumonia worldwide.",
    answer: {
      options: [
        {
          text: "Staphylococcus aureus",
          correct: false,
        },
        {
          text: "Klebsiella pneumoniae",
          correct: false,
        },
        {
          text: "Streptococcus pneumoniae",
          correct: true,
        },
        {
          text: "Pseudomonas aeruginosa",
          correct: false,
        },
        {
          text: "Mycoplasma pneumoniae",
          correct: false,
        },
      ],
    },
    difficulty: 1,
    source: "Learivo sample",
    institution: "",
    examName: "",
    examYear: null,
    path: ["Medicine"],
    tags: ["sample"],
  },
  {
    qtype: "single_choice",
    stem: "Which blood test reflects average blood glucose over the previous 2 to 3 months?",
    explanation:
      "HbA1c measures haemoglobin that has glucose attached. Red cells live about 120 days, so it reflects the recent average.",
    answer: {
      options: [
        {
          text: "Fasting plasma glucose",
          correct: false,
        },
        {
          text: "Glycated haemoglobin (HbA1c)",
          correct: true,
        },
        {
          text: "Random plasma glucose",
          correct: false,
        },
        {
          text: "Urine ketones",
          correct: false,
        },
      ],
    },
    difficulty: 1,
    source: "Learivo sample",
    institution: "",
    examName: "",
    examYear: null,
    path: ["Medicine"],
    tags: ["sample"],
  },
];
