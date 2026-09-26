export type CategoryId = "for-you" | "popular" | "top-picks" | "bestsellers";
export type Book = {
  id: string;
  title: string;
  author: string;
  cover: string;
  isbn: string;
  topic: string;
  description: string;
  categories: CategoryId[];
};

export const categories: { id: CategoryId; label: string }[] = [
  { id: "for-you", label: "For you" },
  { id: "popular", label: "Most popular" },
  { id: "top-picks", label: "Top picks" },
  { id: "bestsellers", label: "Bestsellers" },
];

export const books: Book[] = [
  {
    id: "steve-jobs",
    title: "Steve Jobs",
    author: "Walter Isaacson",
    isbn: "9781451648539",
    cover: "/book-discovery/steve-jobs.jpg",
    topic: "Creativity & ambition",
    description:
      "A life shaped by design, conviction, and the desire to make something that matters.",
    categories: ["for-you", "popular", "bestsellers"],
  },
  {
    id: "educated",
    title: "Educated",
    author: "Tara Westover",
    isbn: "9780399590504",
    cover: "/book-discovery/educated.jpg",
    topic: "Growth & identity",
    description:
      "A memoir about finding an education, a voice, and a different way of seeing the world.",
    categories: ["for-you", "top-picks"],
  },
  {
    id: "subtle-art",
    title: "The Subtle Art of Not Giving a F*ck",
    author: "Mark Manson",
    isbn: "9780062457714",
    cover: "/book-discovery/subtle-art.jpg",
    topic: "Values & perspective",
    description: "An invitation to decide what deserves your attention—and what you can let go of.",
    categories: ["for-you", "popular", "bestsellers"],
  },
  {
    id: "atomic-habits",
    title: "Atomic Habits",
    author: "James Clear",
    isbn: "9780735211292",
    cover: "/book-discovery/atomic-habits.jpg",
    topic: "Habits & progress",
    description:
      "Explore how small, repeatable actions can make meaningful change feel more achievable.",
    categories: ["for-you", "popular", "top-picks", "bestsellers"],
  },
  {
    id: "psychology-of-money",
    title: "The Psychology of Money",
    author: "Morgan Housel",
    isbn: "9780857197689",
    cover: "/book-discovery/psychology-of-money.jpg",
    topic: "Behavior & decisions",
    description:
      "A collection of perspectives on the personal experiences and habits behind money decisions.",
    categories: ["for-you", "top-picks", "bestsellers"],
  },
  {
    id: "four-thousand-weeks",
    title: "Four Thousand Weeks",
    author: "Oliver Burkeman",
    isbn: "9780374159122",
    cover: "/book-discovery/four-thousand-weeks.jpg",
    topic: "Time & attention",
    description:
      "Make room for what matters by reconsidering the promise of getting everything done.",
    categories: ["for-you", "top-picks"],
  },
];

export const heroBooks = [books[0], books[2], books[4], books[1], books[3], books[5]];
