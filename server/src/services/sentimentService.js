import Sentiment from 'sentiment';

const analyzer = new Sentiment();

export function evaluateSentiment(text) {
  const result = analyzer.analyze(text ?? '');
  const label = result.score > 1 ? 'positive' : result.score < -1 ? 'negative' : 'neutral';
  const color = label === 'positive' ? '#FFD166' : label === 'negative' ? '#EF476F' : '#118AB2';
  return {
    label,
    score: result.score,
    comparative: result.comparative,
    tokens: result.tokens,
    color
  };
}
