/**
 * @param {{time: Array.<number>, ref: Array.<number>}} options
 * @return {function(number): number}
 */
var makeInterpolator = function(options) {

  /* Initialise variables */
  
  var time = options.time;
  var ref = options.ref;
  var seg_grad = 0;
  var seg_idx = 0;
  var prev_seg_idx = 0;
  var n_elements = time.length;
  var result;

  var acc_start;          // Start of segment acceleration
  var acc_end;            // End of segment acceleration
  var grad_start;         // Start of segment gradient
  var grad_spline;        // Spline connection gradient
  var grad_end;           // Start of segment gradient
  var spline_time;        // Time within segment of spline connection
  var seg_duration;       // Segment duration  
  var seg_time;           // Time within segment

  var det;
  var spline_t_ratio;
  var grad_prev;
  var grad_seg;
  var grad_next;
  var delta_grad;
  var grad_seg_ratio;
  var min_grad_seg_ratio;
  var max_grad_seg_ratio;
  var normalised_acc_limit;
  var weight;               // Weight factor for gradient calculation    
  
  /* Real time calculation */
  
  return function(ref_time) {
      
    while(ref_time >= time[seg_idx])      // while time exceeds end of segment
    {
        if(++seg_idx >= n_elements)                 // If vector complete
        {
            seg_idx = n_elements - 1;                   // Force segment index to last seg
            return ref[n_elements - 1];                 // Enter coast
        }
    }

    // If time is in a new segment, calculate the spline parameters for this segment

    if(seg_idx != prev_seg_idx)
    {
        prev_seg_idx = seg_idx;

        // Calculate gradients for this segment and the segments before and after

        seg_duration =  time[seg_idx] - time[seg_idx - 1];
        grad_seg     = (ref [seg_idx] - ref [seg_idx - 1]) / seg_duration;

        if(seg_idx == 1)
        {
            grad_prev = 0.0;
        }
        else
        {
            grad_prev = (ref [seg_idx - 1] - ref [seg_idx - 2]) /
                        (time[seg_idx - 1] - time[seg_idx - 2]);
        }

        if((seg_idx + 1) >= n_elements)
        {
            grad_next = 0.0;
        }
        else
        {
            grad_next = (ref [seg_idx + 1] - ref [seg_idx]) /
                        (time[seg_idx + 1] - time[seg_idx]);
        }

        // Calculate gradients for start and end of segment

        if(grad_seg == 0.0)                                 // If current segment is flat
        {
            grad_start = 0.0;                                 // start and end gradients are zero
            grad_end   = 0.0;
        }
        else                                                // else current segment is not flat
        {
            if(grad_prev == 0.0 ||                                  // If previous segment is flat, or
               grad_prev * grad_seg < 0.0)                          // gradient changes sign
            {
                grad_start = 0.0;                                     // start gradient is zero
            }
            else                                                    // else gradients are same sign
            {
                weight = (time[seg_idx - 1] - time[seg_idx - 2]) /
                         (time[seg_idx]     - time[seg_idx - 2]);

                grad_start = weight * (grad_seg - grad_prev) + grad_prev;
            }

            if(grad_next == 0.0 ||                                  // If next segment is flat, or
               grad_next * grad_seg < 0.0)                          // gradient changes sign
            {
                grad_end = 0.0;                                     // end gradient is zero
            }
            else                                                    // else gradients are same sign
            {
                 weight = (time[seg_idx + 1] - time[seg_idx    ]) /
                          (time[seg_idx + 1] - time[seg_idx - 1]);

                 grad_end = weight * (grad_seg - grad_next) + grad_next;
            }
        }

        // Calculate time and gradient of spline connection point

        delta_grad = grad_end - grad_start;     // Change in start and end gradients

        if(Math.abs(delta_grad) < 1.0E-10)                    // If start and end gradients are equal
        {
            spline_t_ratio    = 0.5;                                // Spline is at mid-point
            grad_spline = 2.0 * grad_seg - grad_end;    // Calculate spline connection gradient
        }
        else                                                // else start and end gradients are different
        {
            min_grad_seg_ratio = 0.001;
            max_grad_seg_ratio = 0.999;

            grad_seg_ratio = (grad_seg - grad_start) / delta_grad;

            // if segment ratio is in range to avoid exceeding acceleration limits

            if(min_grad_seg_ratio < grad_seg_ratio && grad_seg_ratio < max_grad_seg_ratio)
            {
                spline_t_ratio = 1.0 - grad_seg_ratio;              // Spline gradient will be segment gradient
            }
            else  // else minimise accelerations of each parabola by being equal and opposite
            {
                det = Math.sqrt(0.5 + grad_seg_ratio * (grad_seg_ratio - 1.0));

                if(grad_seg_ratio < 0.5)
                {
                    spline_t_ratio = 1.0 - grad_seg_ratio - det;
                }
                else if(grad_seg_ratio > 0.5)
                {
                    spline_t_ratio = 1.0 - grad_seg_ratio + det;
                }
                else
                {
                    spline_t_ratio = 0.5;                           // Spline is at mid-point
                }
            }

            grad_spline = (spline_t_ratio + 2.0 * grad_seg_ratio - 1.0) * delta_grad + grad_start;
        }

        spline_time = spline_t_ratio * seg_duration;

        // Calculate start and end accelerations

        acc_start = (grad_spline - grad_start)  / spline_time;
        acc_end   = (grad_end    - grad_spline) / (seg_duration - spline_time);
    }

    // Calculate reference using spline parameters

    seg_time = ref_time - time[seg_idx - 1];

    if(seg_time < spline_time)                  // If before spline connection
    {
        return ref[seg_idx - 1] + seg_time * (0.5 * acc_start * seg_time + grad_start);
    }
    else                                        // else after spline connection
    {
        seg_time -= seg_duration;                   // Time is negative (t=0 for end of segment)
        return ref[seg_idx] + seg_time * (0.5 * acc_end * seg_time + grad_end);
    }
  };
};

// EOF
