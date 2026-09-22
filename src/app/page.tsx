// The only page. Reads ?l= (language) and ?c= (the invited company's register
// number, a label) on the server and hands both to the client-side Form.
import { Form } from "@/components/Form";
import { parseLang } from "@/i18n";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Page({ searchParams }: Props) {
  const params = await searchParams;
  const tag = typeof params.c === "string" && params.c.length <= 32 ? params.c : undefined;
  return <Form initialLang={parseLang(params.l)} companyTag={tag} />;
}
