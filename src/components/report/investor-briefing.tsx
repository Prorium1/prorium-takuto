import { briefingTopics } from "@/lib/domain/briefing";
import type { BriefingStory } from "@/lib/domain/types";

const kindLabel = {
  Actual: "実績",
  Committed: "確約済み",
  Forecast: "見込み",
  Pipeline: "進行中",
};

export function InvestorBriefing({ stories }: { stories: BriefingStory[] }) {
  const groups = briefingTopics
    .map((topic) => ({
      ...topic,
      stories: stories.filter((story) => story.topic === topic.key),
    }))
    .filter((group) => group.stories.length);
  if (!groups.length) return null;
  return (
    <section id="briefing" className="report-section briefing-section">
      <div className="section-heading">
        <span className="section-number">04A</span>
        <div>
          <h2>Inside Prorium</h2>
          <p>数字の奥にある、事業・人・市場の現在地。</p>
        </div>
      </div>
      <div className="briefing-intro">
        <span className="eyebrow">THE MONTH IN CONTEXT</span>
        <p>
          財務報告と事業報告に加え、今月の経営判断をテーマ別にお伝えします。
        </p>
        <span>
          {String(stories.length).padStart(2, "0")} STORIES /{" "}
          {String(groups.length).padStart(2, "0")} TOPICS
        </span>
      </div>
      <div className="briefing-groups">
        {groups.map((group) => (
          <div
            className="briefing-group"
            id={`briefing-${group.key}`}
            key={group.key}
          >
            <div className="briefing-group-label">
              <span>{group.eyebrow}</span>
              <h3>{group.label}</h3>
            </div>
            <div className="briefing-stories">
              {group.stories.map((story, storyIndex) => (
                <article className="briefing-story" key={story.id}>
                  <div className="briefing-story-top">
                    <span
                      className={`indicator-kind kind-${story.kind.toLowerCase()}`}
                    >
                      {story.kind} · {kindLabel[story.kind]}
                    </span>
                    <span className="briefing-story-index">
                      {String(storyIndex + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h4>{story.title}</h4>
                  <p>{story.body}</p>
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
