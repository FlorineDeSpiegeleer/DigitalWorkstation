              <h2 className="text-[16px] font-black text-slate-900">
                Niets ophalen
              </h2>
            </div>
          ) : (
            pickupItems.map((item, index) => {
              const checked = Boolean(pickupChecks[item.id]);

              return (
                <button
                  key={item.id}
                  onClick={() =>
                    setPickupChecks((prev) => ({
                      ...prev,
                      [item.id]: !prev[item.id],
                    }))
                  }
                  className={`w-full rounded-xl border-2 p-2 text-left ${
                    checked
                      ? 'border-emerald-300 bg-emerald-50'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[13px] font-black ${
                        checked
                          ? 'bg-emerald-500 text-white'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {checked ? '✓' : index + 1}
                    </div>

                    <div className="min-w-0">
                      <p className="text-[12px] leading-tight font-black text-slate-900">
                        {item.label}
                      </p>
                      <p className="text-[10px] leading-tight font-bold text-blue-700 mt-0.5">
                        {item.location}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </main>

        <footer className="p-2 pt-1 bg-slate-50 flex-shrink-0">
          <BigAction
            onClick={() => {
              if (refillItems.length === 0) {
                finishStation();
              } else {
                setScreen('refill');
              }
            }}
            disabled={!allPicked}
            green
          >
            {refillItems.length === 0 ? 'KLAAR' : 'ALLES OPGEHAALD'}
          </BigAction>
        </footer>
      </div>
    );
  }

  /* 6. AANVULLEN */
  const allRefilled =
    refillItems.length === 0 ||
    refillItems.every((item) => Boolean(refillChecks[item.id]));

  return (
    <div className="h-[100dvh] w-full bg-slate-50 flex flex-col overflow-hidden">
      <WristHeader
        eyebrow={currentStation.name}
        title="Aanvullen"
        onBack={() => setScreen('pickup')}
      />

      <main className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5">
        {refillItems.map((item, index) => {
          const checked = Boolean(refillChecks[item.id]);

          return (
            <button
              key={item.id}
              onClick={() =>
                setRefillChecks((prev) => ({
                  ...prev,
                  [item.id]: !prev[item.id],
                }))
              }
              className={`w-full rounded-xl border-2 p-2 text-left ${
                checked
                  ? 'border-emerald-300 bg-emerald-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-start gap-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[13px] font-black ${
                    checked
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {checked ? '✓' : index + 1}
                </div>

                <div className="min-w-0">
                  <p className="text-[12px] leading-tight font-black text-slate-900">
                    {item.label}
                  </p>
                  <p className="text-[10px] leading-tight font-bold text-emerald-700 mt-0.5">
                    {item.location}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </main>

      <footer className="p-2 pt-1 bg-slate-50 flex-shrink-0">
        <BigAction onClick={finishStation} disabled={!allRefilled} green>
          WERKPOST KLAAR
