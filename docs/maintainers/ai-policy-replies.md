# Saved replies for ASL003 (AI Use Practice)

Canned replies for maintainers, following the Maintainer Practices in
[ASL003](https://allstarlink.org/ai/). Edit them to fit the situation.
A first violation is normally handled by explaining the policy and inviting
resubmission. Be courteous. Use the GitHub "Saved replies" feature to reuse them.

Reminder: do not send non-public contributions, security reports, or private
user information to third-party AI services without the submitter's consent.

## (a) First-time close of an apparently unreviewed AI contribution

```markdown
Thanks for taking the time to contribute to AllStarLink.

I'm closing this for now because it looks like it may not have been fully
reviewed or tested by you before submitting. Our [AI Use Practice
(ASL003)](https://allstarlink.org/ai/) welcomes AI-assisted contributions, but
the contributor needs to understand every part of the change, have built and
tested it, and be able to explain and defend it in review.

You're welcome to resubmit once you've gone through the change line by line and
tested it. Please fill out the AI Use Disclosure and Contributor Attestation
sections of the pull request template. If AI involvement was material, an
`Assisted-by:` commit trailer is appreciated. If anything in the policy is
unclear, just ask and we'll help.
```

## (b) Asking the contributor to explain a specific part of their change

```markdown
Thanks for the contribution. Could you walk me through [the specific part, e.g.
the retry logic in `foo.c` lines 120-160]? In particular, why is it needed, how
does it work, and what alternatives did you consider?

Under [ASL003](https://allstarlink.org/ai/) we ask contributors to be able to
explain and defend every part of their change in review, in their own words.
Also, if AI tools were involved in this part, it would help me to know how they
were used. Either way, we'll review it on its technical merits.
```

