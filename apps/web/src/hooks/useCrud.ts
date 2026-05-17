import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface UseCrudOptions {
  endpoint: string;
  queryParams?: Record<string, any>;
  autoFetch?: boolean;
}

export function useCrud<T = any>({ endpoint, queryParams = {}, autoFetch = true }: UseCrudOptions) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPageState] = useState(1);
  const [search, setSearch] = useState('');
  const limit = 20;

  // Stable ref to avoid stale closure issues with queryParams
  const queryParamsRef = useRef(queryParams);
  useEffect(() => {
    queryParamsRef.current = queryParams;
  });

  const fetchData = useCallback(async (p?: number) => {
    setLoading(true);
    try {
      const currentPage = p ?? page;
      const res = await api.get(endpoint, {
        params: {
          page: currentPage,
          limit,
          search: search || undefined,
          ...queryParamsRef.current,
        },
      });
      const result = res.data;
      if (Array.isArray(result)) {
        setData(result);
        setTotal(result.length);
      } else if (result?.data) {
        setData(result.data);
        setTotal(result.total ?? result.meta?.total ?? result.data.length);
      } else if (result?.items) {
        setData(result.items);
        setTotal(result.total ?? result.items.length);
      } else {
        setData([]);
        setTotal(0);
      }
    } catch {
      // errors handled by api interceptor
    } finally {
      setLoading(false);
    }
  }, [endpoint, page, search]); // queryParams handled via ref

  useEffect(() => {
    if (autoFetch) fetchData();
  }, [fetchData, autoFetch]);

  const create = async (body: any) => {
    const res = await api.post(endpoint, body);
    toast.success('Muvaffaqiyatli yaratildi');
    fetchData();
    return res.data;
  };

  const update = async (id: string | number, body: any) => {
    const res = await api.patch(`${endpoint}/${id}`, body);
    toast.success('Muvaffaqiyatli yangilandi');
    fetchData();
    return res.data;
  };

  const remove = async (id: string | number) => {
    await api.delete(`${endpoint}/${id}`);
    toast.success("Muvaffaqiyatli o'chirildi");
    fetchData();
  };

  // setPage only updates state; useEffect will trigger fetchData automatically
  const setPage = (p: number) => {
    setPageState(p);
  };

  const totalPages = total > 0 ? Math.ceil(total / limit) : 1;

  return {
    data, loading, total, page, totalPages, search,
    setSearch, setPage, refetch: fetchData,
    create, update, remove,
  };
}
