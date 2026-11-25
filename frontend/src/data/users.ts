export interface User {
  id: string;
  email: string;
  name: string;
}

export const users: User[] = [
  {
    id: "c0975a9f-67f7-4e9c-8744-d4ffae38a15b",
    email: "denise.ustgradsch@gmail.com",
    name: "Denise (Mother)",
  },
  {
    id: "1c13d870-1b6e-468d-a046-1b125796faf5",
    email: "deymler.krysler@gmail.com",
    name: "Daimler",
  },
];

const usersById = new Map(users.map(user => [user.id, user]));

/** Display name for a user ID; falls back to the email (if given), then the raw ID. */
export function userDisplayName(id: string, fallbackEmail?: string): string {
  return usersById.get(id)?.name ?? fallbackEmail ?? id;
}
