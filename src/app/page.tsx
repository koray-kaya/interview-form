// The only page. Reads ?l= on the server and hands the language to the
// client-side Form; ?c= (the company tag) is read in M2.
import { Form } from "@/components/Form";
import { parseLang } from "@/i18n";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Page({ searchParams }: Props) {
  const params = await searchParams;
  return <Form initialLang={parseLang(params.l)} />;
}
