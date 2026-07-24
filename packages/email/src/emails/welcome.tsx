import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Html,
	Img,
	Preview,
	Section,
	Text,
} from "@react-email/components";
import { Tailwind } from "@react-email/tailwind";
import { env } from "../lib/env";

const utm = (content: string) =>
	`?utm_source=email&utm_medium=lifecycle&utm_campaign=welcome&utm_content=${content}`;

const DOWNLOAD = "https://superset.sh/download";

interface WelcomeEmailProps {
	userName?: string;
}

export function WelcomeEmail({ userName: _userName }: WelcomeEmailProps = {}) {
	return (
		<Html>
			<Head />
			<Tailwind
				config={{
					theme: {
						extend: {
							colors: {
								clay: "#CC785C",
								background: "#F5F3EC",
								band: "#EDEAE0",
								card: "#EAE7DC",
								foreground: "#1F1E1D",
								muted: "#5E5D59",
								border: "#DDD9CC",
							},
							fontFamily: {
								serif: ["Georgia", "Times New Roman", "serif"],
								sans: [
									"-apple-system",
									"BlinkMacSystemFont",
									"Segoe UI",
									"Helvetica",
									"Arial",
									"sans-serif",
								],
							},
						},
					},
				}}
			>
				<Body className="m-0 bg-background font-serif">
					<Preview>
						Your command center for coding agents — let&apos;s get you set up.
					</Preview>
					<Container className="mx-auto max-w-[640px] bg-background">
						<Section className="bg-clay py-5 text-center">
							<Img
								src={`${env.NEXT_PUBLIC_MARKETING_URL}/assets/emails/logo-full.png`}
								alt="Superset"
								width="150"
								className="mx-auto"
							/>
						</Section>

						<Section className="px-10 pt-12">
							<Heading className="m-0 mb-10 text-center font-normal font-serif text-[40px] text-foreground leading-[1.15]">
								Welcome to Superset,
								<br />
								your agent command center
							</Heading>

							<Section className="mb-10 rounded-2xl bg-card p-6">
								<Img
									src={`${env.NEXT_PUBLIC_MARKETING_URL}/assets/emails/welcome-hero.png`}
									alt="Superset running coding agents across parallel workspaces"
									width="528"
									className="w-full rounded-xl"
								/>
							</Section>

							<Text className="m-0 mb-6 font-serif text-[18px] text-foreground leading-[28px]">
								Welcome to Superset, your command center for coding agents —
								ready to take on real work from your backlog.
							</Text>

							<Text className="m-0 mb-4 font-bold font-serif text-[18px] text-foreground leading-[28px]">
								Imagine shipping with a team of agents that:
							</Text>

							<ul className="m-0 mb-6 pl-6">
								<li className="mb-2 font-serif text-[18px] text-foreground leading-[28px]">
									works in parallel, each in its own isolated workspace
								</li>
								<li className="mb-2 font-serif text-[18px] text-foreground leading-[28px]">
									keeps every change on its own branch, ready to review
								</li>
								<li className="font-serif text-[18px] text-foreground leading-[28px]">
									picks up tasks and runs while you focus elsewhere
								</li>
							</ul>

							<Text className="m-0 mb-10 font-serif text-[18px] text-foreground leading-[28px]">
								That&apos;s Superset.
							</Text>

							<Section className="pb-14 text-center">
								<Button
									href={`${DOWNLOAD}${utm("hero-cta")}`}
									className="rounded-full bg-foreground px-12 py-[15px] font-sans text-[17px] text-white no-underline"
								>
									Get the desktop app
								</Button>
							</Section>
						</Section>

						<Section className="bg-band px-10 pt-14 pb-4">
							<Heading
								as="h2"
								className="m-0 mb-8 text-center font-normal font-serif text-[36px] text-foreground leading-[1.15]"
							>
								Point agents at real work
							</Heading>

							<Text className="m-0 mb-6 font-serif text-[18px] text-foreground leading-[28px]">
								The easiest way to get started is to hand an agent one thing you
								were already going to do this week.
							</Text>

							<Text className="m-0 mb-10 font-bold font-serif text-[18px] text-foreground leading-[28px]">
								Here are a few simple ideas:
							</Text>

							<Heading
								as="h3"
								className="m-0 mb-3 font-normal font-serif text-[26px] text-foreground leading-[1.2]"
							>
								Clear a bug from your backlog
							</Heading>
							<Text className="m-0 mb-4 font-serif text-[18px] text-foreground leading-[28px]">
								&ldquo;Take that flaky test and fix it in an isolated
								workspace.&rdquo;
							</Text>
							<Text className="m-0 mb-12 font-serif text-[18px] leading-[28px]">
								<a
									href={`${DOWNLOAD}${utm("idea-bug")}`}
									className="font-bold font-sans text-[16px] text-foreground underline"
								>
									Download Superset
								</a>
							</Text>

							<Heading
								as="h3"
								className="m-0 mb-3 font-normal font-serif text-[26px] text-foreground leading-[1.2]"
							>
								Run two agents side by side
							</Heading>
							<Text className="m-0 mb-4 font-serif text-[18px] text-foreground leading-[28px]">
								&ldquo;Have Claude Code refactor the API while Codex writes the
								tests.&rdquo;
							</Text>
							<Text className="m-0 mb-12 font-serif text-[18px] leading-[28px]">
								<a
									href={`https://docs.superset.sh/providers${utm("idea-agents")}`}
									className="font-bold font-sans text-[16px] text-foreground underline"
								>
									See supported agents
								</a>
							</Text>

							<Heading
								as="h3"
								className="m-0 mb-3 font-normal font-serif text-[26px] text-foreground leading-[1.2]"
							>
								Turn your TODO list into tasks
							</Heading>
							<Text className="m-0 mb-4 font-serif text-[18px] text-foreground leading-[28px]">
								&ldquo;Plan the work as tasks, dispatch an agent to each, review
								the diffs.&rdquo;
							</Text>
							<Text className="m-0 mb-12 font-serif text-[18px] leading-[28px]">
								<a
									href={`https://docs.superset.sh${utm("idea-tasks")}`}
									className="font-bold font-sans text-[16px] text-foreground underline"
								>
									See how tasks work
								</a>
							</Text>

							<Section className="pb-14 text-center">
								<Button
									href={`${DOWNLOAD}${utm("mid-cta")}`}
									className="rounded-full bg-foreground px-12 py-[15px] font-sans text-[17px] text-white no-underline"
								>
									Get the desktop app
								</Button>
							</Section>
						</Section>

						<Section className="px-10 pt-14">
							<Heading
								as="h3"
								className="m-0 mb-4 font-normal font-serif text-[26px] text-foreground leading-[1.2]"
							>
								Why Superset is different
							</Heading>
							<Text className="m-0 mb-12 font-serif text-[18px] text-foreground leading-[28px]">
								Agents are only useful when they can work like teammates.
								Superset gives every agent an isolated copy of your repo on its
								own branch — so they work in parallel, never step on each other,
								and each change comes back as a reviewable diff.
							</Text>

							<Heading
								as="h3"
								className="m-0 mb-4 font-normal font-serif text-[26px] text-foreground leading-[1.2]"
							>
								Questions?
							</Heading>
							<Text className="m-0 mb-12 font-serif text-[18px] text-foreground leading-[28px]">
								Just reply to this email — a founder reads every message.
							</Text>
						</Section>

						<Section className="px-10 pt-4 pb-12 text-center">
							<Img
								src={`${env.NEXT_PUBLIC_MARKETING_URL}/assets/emails/logo-full.png`}
								alt="Superset"
								width="130"
								className="mx-auto mb-6"
							/>
							<Text className="m-0 mb-6">
								<a
									href="https://x.com/superset_sh"
									className="mx-2 inline-block"
								>
									<Img
										src={`${env.NEXT_PUBLIC_MARKETING_URL}/assets/emails/x.png`}
										alt="X"
										width="22"
										height="22"
									/>
								</a>
								<a
									href="https://instagram.com/superset"
									className="mx-2 inline-block"
								>
									<Img
										src={`${env.NEXT_PUBLIC_MARKETING_URL}/assets/emails/instagram.png`}
										alt="Instagram"
										width="22"
										height="22"
									/>
								</a>
								<a
									href="https://www.linkedin.com/company/superset-sh"
									className="mx-2 inline-block"
								>
									<Img
										src={`${env.NEXT_PUBLIC_MARKETING_URL}/assets/emails/linkedin.png`}
										alt="LinkedIn"
										width="22"
										height="22"
									/>
								</a>
							</Text>
							<Text className="m-0 mb-2 font-sans text-[13px] text-muted leading-[20px]">
								<a
									href="https://superset.sh/privacy"
									className="text-muted underline"
								>
									Privacy
								</a>{" "}
								&bull;{" "}
								<a
									href="https://superset.sh/terms"
									className="text-muted underline"
								>
									Terms
								</a>{" "}
								&bull;{" "}
								<a
									href="https://superset.sh/contact"
									className="text-muted underline"
								>
									Contact
								</a>
							</Text>
							<Text className="m-0 font-sans text-[13px] text-muted leading-[20px]">
								&copy; 2026 Superset. All rights reserved.
							</Text>
						</Section>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
}

export default WelcomeEmail;
