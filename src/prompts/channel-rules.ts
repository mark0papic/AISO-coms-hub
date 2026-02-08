export const CHANNEL_RULES: Record<string, string> = {
  whatsapp_message: `
- Maximum 1500 characters
- Short, punchy, friendly tone
- Emojis are encouraged (2-4 per message)
- Include a clear CTA (e.g. "Sign up here: [link]")
- If a signup link is provided, include it
- NO formal greetings or sign-offs
- Write as if texting a friend about something exciting`,

  member_email_subject: `
- Maximum 60 characters ideal, 150 hard limit
- No clickbait, be genuinely informative
- Include the event/initiative name
- Create mild urgency when appropriate`,

  member_email_body: `
- Scannable: use short paragraphs (2-3 sentences max)
- Include signup link if provided (as a clear CTA)
- NO em dashes -- use commas, periods, or semicolons instead
- Structure: hook paragraph, details, logistics, CTA
- Professional but warm tone
- Include date/time/location if provided`,

  linkedin_post: `
- ABSOLUTELY NO URLs or links anywhere in the body text
- Professional yet personable tone
- Open with a hook line (question or bold statement)
- Use line breaks for readability
- End with a soft CTA ("Comment below", "DM us", "Check link in comments")
- Maximum 3000 characters
- Hashtags: 3-5 relevant ones at the end`,

  instagram_caption: `
- ABSOLUTELY NO URLs or links anywhere in the body (Instagram does not make them clickable)
- Engaging, visual-friendly language
- Open with a hook (first line visible before "...more")
- Emojis used purposefully, not excessively
- End with CTA: "Link in bio" if signup link exists
- Maximum 2200 characters
- Hashtags: 10-15 relevant ones, separated by line breaks at the end`,

  luma_description: `
- Structured with clear sections: About, What to Expect, Logistics
- Include agenda if it can be inferred from the brief
- Date, time, location prominently displayed
- Professional, informative tone
- Include any partners/speakers if provided
- Signup link can be included if provided
- Maximum 5000 characters`,

  ambassador_message: `
- Written as a briefing to AISO ambassadors
- Include key talking points they can share
- Provide the "why this matters" context
- Casual-professional tone (peer-to-peer)
- Include any incentives if provided
- Clear ask: what you want ambassadors to do
- Maximum 2000 characters`,

  internal_aiso_brief: `
- Internal team summary, not for public distribution
- Factual, concise, no marketing language
- Include: objective, target audience, key dates, channels being used
- Note any dependencies or blockers if apparent from the brief
- Maximum 3000 characters`,
};
