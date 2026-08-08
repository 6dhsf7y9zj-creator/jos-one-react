import type {
  InventoryItem,
  ListingChecklist,
  ListingPipelineStage,
  PhotoChecklist,
  StockStatus,
} from '../types/inventory.ts'

export const pipelineStages: ListingPipelineStage[] = [
  'Preparation',
  'Photography',
  'Photo Review',
  'Listing Copy',
  'Ready to Upload',
  'Live',
]

export const emptyPhotoChecklist: PhotoChecklist = {
  front: false,
  back: false,
  brandLabel: false,
  sizeLabel: false,
  careLabel: false,
  measurements: false,
  defects: false,
}

export const emptyListingChecklist: ListingChecklist = {
  title: false,
  description: false,
  measurements: false,
  condition: false,
  price: false,
  platform: false,
}

export function inferPipelineStage(item: InventoryItem): ListingPipelineStage {
  if (item.pipelineStage && pipelineStages.includes(item.pipelineStage)) return item.pipelineStage
  if (item.status === 'Live' || item.status === 'Sold' || item.status === 'Dispatched' || item.status === 'Archived') return 'Live'
  if (item.status === 'Photographed') return 'Listing Copy'
  return 'Preparation'
}

export function normalisePipelineItem(item: InventoryItem): InventoryItem {
  return {
    ...item,
    pipelineStage: inferPipelineStage(item),
    photoChecklist: { ...emptyPhotoChecklist, ...(item.photoChecklist ?? {}) },
    listingChecklist: { ...emptyListingChecklist, ...(item.listingChecklist ?? {}) },
  }
}

function completedCount(record: Record<string, boolean>): number {
  return Object.values(record).filter(Boolean).length
}

export function photoCompletion(item: InventoryItem): number {
  const checklist = normalisePipelineItem(item).photoChecklist!
  return Math.round((completedCount(checklist as unknown as Record<string, boolean>) / Object.keys(checklist).length) * 100)
}

export function listingCompletion(item: InventoryItem): number {
  const checklist = normalisePipelineItem(item).listingChecklist!
  return Math.round((completedCount(checklist as unknown as Record<string, boolean>) / Object.keys(checklist).length) * 100)
}

export function pipelineReadiness(item: InventoryItem): number {
  const normalised = normalisePipelineItem(item)
  const stageScore = pipelineStages.indexOf(normalised.pipelineStage!) / (pipelineStages.length - 1)
  const photoScore = photoCompletion(normalised) / 100
  const listingScore = listingCompletion(normalised) / 100
  return Math.round((stageScore * 0.35 + photoScore * 0.35 + listingScore * 0.30) * 100)
}

export function stageToStockStatus(stage: ListingPipelineStage, existing: StockStatus): StockStatus {
  if (stage === 'Live') return 'Live'
  if (stage === 'Listing Copy' || stage === 'Ready to Upload') return 'Photographed'
  if (existing === 'Sold' || existing === 'Dispatched' || existing === 'Archived') return existing
  return 'Prep'
}

export function advancePipeline(item: InventoryItem): InventoryItem {
  const normalised = normalisePipelineItem(item)
  const currentIndex = pipelineStages.indexOf(normalised.pipelineStage!)
  const next = pipelineStages[Math.min(currentIndex + 1, pipelineStages.length - 1)]
  const now = new Date().toISOString()

  return {
    ...normalised,
    pipelineStage: next,
    status: stageToStockStatus(next, normalised.status),
    photographyStartedAt:
      next === 'Photography' && !normalised.photographyStartedAt
        ? now
        : normalised.photographyStartedAt,
    photographyCompletedAt:
      (next === 'Photo Review' || next === 'Listing Copy') && !normalised.photographyCompletedAt
        ? now
        : normalised.photographyCompletedAt,
    listingReadyAt:
      next === 'Ready to Upload' && !normalised.listingReadyAt
        ? now
        : normalised.listingReadyAt,
    dateListed:
      next === 'Live' && !normalised.dateListed
        ? now.slice(0, 10)
        : normalised.dateListed,
  }
}

export function pipelineBottleneck(items: InventoryItem[]): {
  stage: ListingPipelineStage
  count: number
} {
  const counts = pipelineStages.map(stage => ({
    stage,
    count: items.filter(item => inferPipelineStage(item) === stage).length,
  }))
  return counts.reduce((largest, current) => current.count > largest.count ? current : largest, counts[0])
}
