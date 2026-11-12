import { getUser } from "@/lib/auth"
import { getSnapshot } from "@/lib/queries"
import { Workspace } from "@/components/workspace"
import { SignIn } from "@/components/sign-in"

export const dynamic = "force-dynamic"

export default async function Home() {
  const user = await getUser()
  if (!user) return <SignIn demo={process.env.CSOLUTION_DEMO === "1"} />
  return <Workspace initial={await getSnapshot(user)} />
}
