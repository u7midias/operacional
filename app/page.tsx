export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold">U7 Mídias</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Plataforma de aprovação de posts. Acesse pelo link único enviado
          pela equipe (formato <code>/aprovar/?token=...</code>).
        </p>
      </div>
    </main>
  );
}
