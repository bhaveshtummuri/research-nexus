import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { cn, formatCompact, truncate } from '@/lib/utils';
import type { TopicSummary, TrendingTopic } from '@/types/api';

interface TopicCardProps {
  topic: TopicSummary | TrendingTopic;
  index?: number;
  className?: string;
}

function isTrending(topic: TopicSummary | TrendingTopic): topic is TrendingTopic {
  return 'growthRate' in topic;
}

export function TopicCard({ topic, index = 0, className }: TopicCardProps) {
  const trending = isTrending(topic);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, delay: Math.min(index * 0.02, 0.2) }}
    >
      <Link
        to={`/topics/${topic.id}`}
        className={cn(
          'surface-gradient group flex h-full flex-col rounded-lg border border-border p-4 shadow-subtle transition-all',
          'hover:border-graph-topic/45 hover:shadow-raised',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-medium leading-snug transition-colors group-hover:text-graph-topic">
            {topic.name}
          </h3>
          {trending && topic.growthRate > 1 ? (
            <Badge variant="success" className="shrink-0">
              <TrendingUp className="size-2.5" aria-hidden />
              {topic.growthRate.toFixed(1)}×
            </Badge>
          ) : null}
        </div>

        <p className="mt-1 text-2xs text-muted-foreground">{topic.field}</p>

        <p className="mt-2 flex-1 text-xs leading-relaxed text-muted-foreground">
          {truncate(topic.description, 120)}
        </p>

        <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-2xs text-muted-foreground">
          <span>{formatCompact(topic.paperCount)} papers</span>
          <span>since {topic.emergenceYear}</span>
        </div>
      </Link>
    </motion.div>
  );
}
