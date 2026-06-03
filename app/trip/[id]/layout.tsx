import { TripProvider } from './context';

export default function TripLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  return <TripProvider tripId={params.id}>{children}</TripProvider>;
}
