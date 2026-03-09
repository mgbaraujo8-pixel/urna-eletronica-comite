export interface Candidate {
  number: string;
  name: string;
  party: string;
  vice?: string;
  photo: string;
  age?: string;
  activity?: string;
  votes?: number;
  suspended?: boolean;
}

export interface VoteStep {
  title: string;
  digits: number;
  candidates: Candidate[];
}

export const VOTE_STEPS: VoteStep[] = [
  {
    title: "DEPUTADO FEDERAL",
    digits: 4,
    candidates: [
      { number: "1111", name: "JOÃO DA SILVA", party: "PDS", photo: "https://picsum.photos/seed/candidate1/100/120" },
      { number: "2222", name: "MARIA SOUZA", party: "PLT", photo: "https://picsum.photos/seed/candidate2/100/120" },
    ]
  },
  {
    title: "DEPUTADO ESTADUAL",
    digits: 5,
    candidates: [
      { number: "11111", name: "CARLOS OLIVEIRA", party: "PDS", photo: "https://picsum.photos/seed/candidate3/100/120" },
      { number: "22222", name: "ANA COSTA", party: "PLT", photo: "https://picsum.photos/seed/candidate4/100/120" },
    ]
  },
  {
    title: "SENADOR",
    digits: 3,
    candidates: [
      { number: "111", name: "ROBERTO MENDES", party: "PDS", photo: "https://picsum.photos/seed/candidate5/100/120" },
      { number: "222", name: "LUCIA FERREIRA", party: "PLT", photo: "https://picsum.photos/seed/candidate6/100/120" },
    ]
  },
  {
    title: "GOVERNADOR",
    digits: 2,
    candidates: [
      { number: "11", name: "FERNANDO HENRIQUE", party: "PDS", vice: "PAULO REIS", photo: "https://picsum.photos/seed/candidate7/100/120" },
      { number: "22", name: "MARINA SILVA", party: "PLT", vice: "JORGE LUIZ", photo: "https://picsum.photos/seed/candidate8/100/120" },
    ]
  },
  {
    title: "PRESIDENTE",
    digits: 2,
    candidates: [
      { number: "11", name: "JOSÉ ALENCAR", party: "PDS", vice: "MARCO MACIEL", photo: "https://picsum.photos/seed/candidate9/100/120" },
      { number: "22", name: "DILMA ROUSSEFF", party: "PLT", vice: "MICHEL TEMER", photo: "https://picsum.photos/seed/candidate10/100/120" },
    ]
  }
];
