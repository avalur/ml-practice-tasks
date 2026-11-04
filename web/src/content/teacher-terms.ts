/* What a platform teacher agrees to before the role becomes usable.
 *
 * Bump TEACHER_TERMS_VERSION whenever the substance changes: every teacher whose
 * TeacherGrant.termsVersion differs is asked to accept again on their next visit
 * to /teach, and cannot use the role until they do. Typo fixes need no bump. */

export const TEACHER_TERMS_VERSION = "2026-11-03";

export const TEACHER_TERMS: { title: string; body: string }[] = [
  {
    title: "Your content is yours, and your responsibility",
    body:
      "You keep the rights to the courses, slides and tasks you make here. You confirm " +
      "that you may publish everything you upload — your own work, openly licensed " +
      "material with its attribution, or material you have permission to use. That " +
      "includes text and images an AI assistant produced for you: you check it before " +
      "your students see it.",
  },
  {
    title: "No collecting data, no selling",
    body:
      "A course must not ask students for passwords, payment details, or personal " +
      "data beyond what the site itself collects, and must not link them to pages " +
      "that do. No advertising, no spam, no promotion unrelated to the teaching.",
  },
  {
    title: "Content fit for a classroom",
    body:
      "Nothing hateful, harassing, sexual or otherwise harmful. Assume some of your " +
      "students may be minors.",
  },
  {
    title: "Student data is for teaching",
    body:
      "You will see the names, email addresses and progress of the students who join " +
      "your groups. Use them to teach that course and for nothing else; do not export " +
      "them to other services or share them.",
  },
  {
    title: "Published is not private",
    body:
      "A published course is unlisted by default, but anyone with its link can read " +
      "it. Do not put anything in a course you would not show the whole class.",
  },
  {
    title: "Moderation",
    body:
      "Visitors can report a course. The site administrators may suspend a course, " +
      "which hides it from students until it is reviewed, and may revoke the teacher " +
      "role. You will be told why.",
  },
];
