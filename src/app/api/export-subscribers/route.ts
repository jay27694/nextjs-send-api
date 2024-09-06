import { NextRequest, NextResponse } from 'next/server';
import { stringify } from 'csv-stringify/sync';

interface Subscriber {
    ID: string;
    Email: string;
  }

interface MoosendResponse {
    Code: number;
    Error: string | null;
    Context: {
      Paging: {
        PageSize: number;
        CurrentPage: number;
        TotalResults: number;
        TotalPageCount: number;
      };
      Subscribers: Array<{
        ID: string;
        Email: string;
        // ... other fields
      }>;
    };
  }
  
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const listid = searchParams.get('listid'); 
  const pagesize = parseInt(searchParams.get('pagesize') || '50', 10);
  const apikey = searchParams.get('apikey');

  // Validate parameters
  if (!listid) {
    return NextResponse.json({ error: 'listid is required' }, { status: 400 });
  }  

  if (isNaN(pagesize) || pagesize < 1) {
    return NextResponse.json({ error: 'Invalid pagesize' }, { status: 400 });
  }

  const allSubscribers: Subscriber[] = [];
  let currentPage = 1;
  let totalPages = 1;

  try {
    do {
      const url = `https://api.moosend.com/v3/lists/${listid}/subscribers/subscribed.json?apikey=${apikey}&page=${currentPage}&pagesize=${pagesize}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: MoosendResponse = await response.json();
         
      if (data.Code !== 0 || data.Error) {        
        throw new Error(data.Error || 'Unknown error occurred');
      }

      const { Subscribers, Paging } = data.Context;
      allSubscribers.push(...Subscribers.map(({ ID, Email }) => ({ ID, Email })));

      totalPages = Paging.TotalPageCount;
      currentPage++;

    } while (currentPage <= totalPages);

    // Generate CSV content
    const csvContent = stringify(allSubscribers, { header: true });

    // Set headers for file download
    const headers = new Headers();
    headers.append('Content-Disposition', `attachment; filename=subscribers_${listid}_${Date.now()}.csv`);
    headers.append('Content-Type', 'text/csv');
    
    return new NextResponse(csvContent, { status: 200, headers });

    //return NextResponse.json(allSubscribers);
  } catch (error) {
    console.error('Error fetching from Moosend API:', error);
    return NextResponse.json({ error: "Error fetching from Moosend API" }, { status: 500 });
  }
}
