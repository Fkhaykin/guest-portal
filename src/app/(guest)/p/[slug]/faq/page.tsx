import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { HelpCircle } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { EmptyState } from "@/components/ui/empty-state";

export default async function FaqPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: property } = await supabase
    .from("property")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!property) notFound();

  const { data: faqs } = await supabase
    .from("faq")
    .select("*")
    .eq("property_id", property.id)
    .order("sort_order");

  // Group by category
  const categories = new Map<string, typeof faqs>();
  faqs?.forEach((faq) => {
    const cat = faq.category || "General";
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat)!.push(faq);
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Frequently Asked Questions
        </h2>
        <p className="text-muted-foreground">
          Everything you need to know about your stay
        </p>
      </div>

      {categories.size > 0 ? (
        Array.from(categories.entries()).map(([category, items]) => (
          <div key={category} className="space-y-2">
            {categories.size > 1 && (
              <h3 className="text-lg font-semibold">{category}</h3>
            )}
            <Accordion className="w-full">
              {items?.map((faq) => (
                <AccordionItem key={faq.id} value={faq.id}>
                  <AccordionTrigger className="text-left">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground whitespace-pre-wrap">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        ))
      ) : (
        <EmptyState
          icon={HelpCircle}
          title="No FAQs available yet"
          description="Questions and answers about your stay will appear here once they're added."
        />
      )}
    </div>
  );
}
