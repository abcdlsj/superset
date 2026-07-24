import { Heading, Hr, Section, Text } from "@react-email/components";
import { Button, StandardLayout } from "../components";

const utm = (content: string) =>
	`?utm_source=email&utm_medium=lifecycle&utm_campaign=welcome&utm_content=${content}`;

interface WelcomeEmailProps {
	userName?: string;
}

export function WelcomeEmail({ userName = "there" }: WelcomeEmailProps) {
	return (
		<StandardLayout preview="Your command center for coding agents — let's get you set up.">
			<Heading className="m-0 mb-2 font-semibold text-[28px] text-foreground leading-[1.3]">
				Welcome to Superset, {userName}
			</Heading>
			<Text className="m-0 mb-6 text-[18px] text-muted leading-[26px]">
				Your command center for coding agents.
			</Text>

			<Text className="m-0 mb-4 text-[16px] text-foreground leading-[24px]">
				Imagine shipping with a team of agents that:
			</Text>
			<Text className="m-0 mb-2 text-[16px] text-foreground leading-[24px]">
				&bull;&nbsp;&nbsp;works in parallel, each in its own isolated workspace
			</Text>
			<Text className="m-0 mb-2 text-[16px] text-foreground leading-[24px]">
				&bull;&nbsp;&nbsp;keeps every change on its own branch, ready to review
			</Text>
			<Text className="m-0 mb-4 text-[16px] text-foreground leading-[24px]">
				&bull;&nbsp;&nbsp;picks up tasks and runs while you focus elsewhere
			</Text>
			<Text className="m-0 mb-6 text-[16px] text-foreground leading-[24px]">
				That&apos;s Superset.
			</Text>

			<Section className="mb-8">
				<Button href={`https://superset.sh/download${utm("hero-cta")}`}>
					Get the desktop app
				</Button>
			</Section>

			<Hr className="mb-8 border-border" />

			<Heading
				as="h2"
				className="m-0 mb-2 font-semibold text-[20px] text-foreground leading-[1.3]"
			>
				Three ways to start
			</Heading>
			<Text className="m-0 mb-6 text-[16px] text-muted leading-[24px]">
				The fastest way in is to pick one thing you were going to do anyway —
				and hand it to an agent.
			</Text>

			<Section className="mb-5">
				<Text className="m-0 mb-1 font-semibold text-[16px] text-foreground leading-[24px]">
					Spin up a workspace
				</Text>
				<Text className="m-0 mb-1 text-[15px] text-muted leading-[22px]">
					Every workspace is an isolated copy of your repo on its own branch —
					agents never step on each other, or on you.
				</Text>
				<a
					href={`https://superset.sh/download${utm("card-workspace")}`}
					className="text-[15px] text-foreground underline"
				>
					Download Superset
				</a>
			</Section>

			<Section className="mb-5">
				<Text className="m-0 mb-1 font-semibold text-[16px] text-foreground leading-[24px]">
					Run agents in parallel
				</Text>
				<Text className="m-0 mb-1 text-[15px] text-muted leading-[22px]">
					Kick off Claude Code or Codex on separate tasks and watch them work
					side by side.
				</Text>
				<a
					href={`https://docs.superset.sh/providers${utm("card-agents")}`}
					className="text-[15px] text-foreground underline"
				>
					See supported agents
				</a>
			</Section>

			<Section className="mb-8">
				<Text className="m-0 mb-1 font-semibold text-[16px] text-foreground leading-[24px]">
					Plan with tasks
				</Text>
				<Text className="m-0 mb-1 text-[15px] text-muted leading-[22px]">
					Turn your backlog into tasks, assign them to agents, and review the
					results when they&apos;re done.
				</Text>
				<a
					href={`https://docs.superset.sh${utm("card-tasks")}`}
					className="text-[15px] text-foreground underline"
				>
					See how tasks work
				</a>
			</Section>

			<Hr className="mb-8 border-border" />

			<Text className="m-0 mb-6 text-[16px] text-foreground leading-[24px]">
				Questions, feedback, something broken? Just reply — a founder reads
				every email.
			</Text>

			<Button
				href={`https://superset.sh/download${utm("footer-cta")}`}
				variant="secondary"
			>
				Get Superset
			</Button>
		</StandardLayout>
	);
}

export default WelcomeEmail;
